'use client'

/**
 * Visual Catalog — Catálogo interno tipo "tienda" v2.0
 *
 * Features:
 * - Grid de tarjetas de modelos con imagen, nombre, tallas/colores y stock
 * - Filtros colapsables: línea, categoría, marca, color, texto
 * - Carrito colapsable con toggle
 * - Selección de color y talla en cada tarjeta (clickable)
 * - Botón "+" para agregar al carrito directamente desde la tarjeta
 * - Drawer de carrito con control de cantidades e "Ir al POS"
 * - Integración con POS via localStorage
 * - Modal de detalle con galería de imágenes, stock real por variante, y subida de imágenes
 * - Layout responsivo que se adapta cuando los paneles están ocultos
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useStore } from '@/contexts/store-context'
import { formatCurrency } from '@/lib/utils/currency'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Search, X, ImageIcon, ChevronLeft, ChevronRight,
  Package, Star, Upload, Trash2, Filter, Camera,
  ShoppingCart, Plus, Minus, ArrowRight, Check,
  Grid3x3, List, Store, TrendingUp, AlertCircle, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 24
const CART_KEY = 'boutique_visual_cart'
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'UNICA', 'ÚNICA']

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list' | 'pos'
type SortOption = 'name' | 'recent' | 'price-asc' | 'price-desc' | 'stock'

interface ModelVariant {
  product_id: string
  barcode: string
  size: string | null
  color: string | null
  stock: number
  price: number
  purchase_price: number
}

interface ModelCard {
  base_code: string
  base_name: string
  category_id: string | null
  category_name: string | null
  line_id: string | null
  line_name: string | null
  brand_id: string | null
  brand_name: string | null
  sale_price: number
  purchase_price: number
  total_stock: number
  variant_count: number
  size_names: string[]      // sorted unique sizes
  colors: string[]          // unique colors
  primary_image_url: string | null
  color_images: Record<string, string>  // color (lowercase) → public_url
  variants: ModelVariant[]  // per-variant real stock
}

interface ProductImage {
  id: string
  base_code: string
  color: string | null
  is_primary: boolean
  public_url: string
  storage_path: string
}

/** Matches the POS useCart CartItem format for localStorage bridge */
export interface VisualCartItem {
  product_id: string
  product_name: string
  barcode: string
  quantity: number
  unit_price: number
  subtotal: number
  // Extra visual info (ignored by POS but useful for cart drawer)
  image_url: string | null
  size: string | null
  color: string | null
  base_name: string
}

interface FilterOption { id: string; name: string }

// ─── Color Helpers ────────────────────────────────────────────────────────────

const COLOR_NAME_MAP: Record<string, string> = {
  'negro': 'bg-black', 'black': 'bg-black',
  'blanco': 'bg-white border border-gray-300', 'white': 'bg-white border border-gray-300',
  'rojo': 'bg-red-600', 'red': 'bg-red-600', 'roja': 'bg-red-600',
  'azul': 'bg-blue-600', 'blue': 'bg-blue-600', 'azul marino': 'bg-blue-900',
  'verde': 'bg-green-600', 'green': 'bg-green-600', 'verde olivo': 'bg-lime-700',
  'amarillo': 'bg-yellow-400', 'yellow': 'bg-yellow-400',
  'rosado': 'bg-pink-400', 'rosa': 'bg-pink-400', 'pink': 'bg-pink-400',
  'morado': 'bg-purple-500', 'purple': 'bg-purple-500',
  'violeta': 'bg-violet-500', 'lila': 'bg-violet-300',
  'naranja': 'bg-orange-500', 'orange': 'bg-orange-500',
  'gris': 'bg-gray-400', 'gray': 'bg-gray-400', 'grey': 'bg-gray-400', 'gris oscuro': 'bg-gray-600',
  'beige': 'bg-amber-100 border border-amber-200',
  'cafe': 'bg-amber-700', 'marrón': 'bg-amber-700', 'marron': 'bg-amber-700',
  'celeste': 'bg-sky-400', 'turquesa': 'bg-teal-400',
  'dorado': 'bg-yellow-500', 'plateado': 'bg-gray-300',
  'coral': 'bg-red-400', 'salmon': 'bg-orange-300',
  'crema': 'bg-yellow-50 border border-yellow-200',
}
const HEX_MAP: Record<string, string> = {
  '#000000': 'bg-black', '#FFFFFF': 'bg-white border border-gray-300',
  '#DC2626': 'bg-red-600', '#2563EB': 'bg-blue-600',
  '#16A34A': 'bg-green-600', '#EAB308': 'bg-yellow-500',
  '#EC4899': 'bg-pink-500', '#D4A574': 'bg-amber-300',
}

function colorCls(color: string): string {
  const upper = color.toUpperCase()
  const lower = color.toLowerCase()
  return HEX_MAP[upper] || COLOR_NAME_MAP[lower] || 'bg-gray-400'
}

function ColorDot({
  color,
  size = 'sm',
  selected = false,
  disabled = false,
  onClick,
}: {
  color: string
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
}) {
  const sz = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  const cls = colorCls(color)
  return (
    <span
      title={disabled ? `${color} (no disponible para la talla)` : color}
      onClick={disabled ? undefined : onClick}
      className={[
        'inline-flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-150',
        sz, cls,
        disabled ? 'opacity-25 cursor-not-allowed' : onClick ? 'cursor-pointer' : '',
        selected && !disabled ? 'ring-2 ring-offset-1 ring-primary scale-125 z-10' : '',
      ].join(' ')}
    >
      {selected && !disabled && size !== 'sm' && <Check className="h-2 w-2 text-white drop-shadow-sm" />}
    </span>
  )
}

// ─── Size Sort ────────────────────────────────────────────────────────────────

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase())
    const bi = SIZE_ORDER.indexOf(b.toUpperCase())
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, undefined, { numeric: true })
  })
}

// ─── ModelCardItem ────────────────────────────────────────────────────────────

function ModelCardItem({
  model,
  onOpenDetail,
  onAddToCart,
  isInCart,
}: {
  model: ModelCard
  onOpenDetail: () => void
  onAddToCart: (variant: ModelVariant) => void
  isInCart: boolean
}) {
  const [selSize, setSelSize] = useState<string | null>(
    model.size_names.length === 1 ? model.size_names[0] : null
  )
  const [selColor, setSelColor] = useState<string | null>(
    model.colors.length === 1 ? model.colors[0] : null
  )
  const [justAdded, setJustAdded] = useState(false)

  // Reset selections if model changes (e.g., pagination)
  useEffect(() => {
    setSelSize(model.size_names.length === 1 ? model.size_names[0] : null)
    setSelColor(model.colors.length === 1 ? model.colors[0] : null)
  }, [model.base_code, model.size_names.length, model.colors.length])

  const stockBadgeColor =
    model.total_stock === 0 ? 'text-rose-600' :
    model.total_stock < 5   ? 'text-amber-600' :
    'text-emerald-600'

  // ── Imagen activa: cambia según el color seleccionado ────────────────────
  const displayImage = useMemo(() => {
    if (selColor) {
      const colorKey = selColor.toLowerCase()
      if (model.color_images[colorKey]) return model.color_images[colorKey]
    }
    return model.primary_image_url
  }, [selColor, model.color_images, model.primary_image_url])

  // ── Qué tallas existen para el color seleccionado ─────────────────────────
  // Si no hay color seleccionado, todas las tallas están "disponibles"
  const sizesForSelColor = useMemo(() => {
    if (!selColor) return new Set(model.size_names)
    return new Set(
      model.variants
        .filter(v => v.color === selColor)
        .map(v => v.size)
        .filter(Boolean) as string[]
    )
  }, [model.variants, model.size_names, selColor])

  // ── Qué colores existen para la talla seleccionada ────────────────────────
  // Si no hay talla seleccionada, todos los colores están "disponibles"
  const colorsForSelSize = useMemo(() => {
    if (!selSize) return new Set(model.colors)
    return new Set(
      model.variants
        .filter(v => v.size === selSize)
        .map(v => v.color)
        .filter(Boolean) as string[]
    )
  }, [model.variants, model.colors, selSize])

  // ── Variante exacta que se agregaría al carrito ───────────────────────────
  // BUG FIX: NO hay fallback a model.variants[0].
  // Si la combinación no existe → null (y se muestra error al usuario).
  const matchingVariant = useMemo(() => {
    if (model.variants.length === 0) return null
    if (model.variants.length === 1) return model.variants[0]
    const candidates = model.variants.filter(v => {
      const sOk = !selSize  || v.size  === selSize
      const cOk = !selColor || v.color === selColor
      return sOk && cOk
    })
    if (candidates.length === 0) return null            // ← sin fallback silencioso
    return candidates.find(v => v.stock > 0) ?? candidates[0]
  }, [model.variants, selSize, selColor])

  // ── Click en color: selecciona/deselecciona + auto-selecciona talla única ─
  const handleColorClick = (e: React.MouseEvent, c: string) => {
    e.stopPropagation()
    const newColor = selColor === c ? null : c
    setSelColor(newColor)

    if (newColor) {
      // Si para este color hay UNA sola talla → auto-seleccionarla
      const sizesForNewColor = model.variants
        .filter(v => v.color === newColor)
        .map(v => v.size)
        .filter(Boolean) as string[]
      const uniqueSizes = [...new Set(sizesForNewColor)]
      if (uniqueSizes.length === 1) {
        setSelSize(uniqueSizes[0])
      } else if (selSize && !sizesForNewColor.includes(selSize)) {
        // La talla actual no existe para este color → limpiarla
        setSelSize(null)
      }
    }
  }

  // ── Click en talla: selecciona/deselecciona + auto-selecciona color único ─
  const handleSizeClick = (e: React.MouseEvent, s: string) => {
    e.stopPropagation()
    const newSize = selSize === s ? null : s
    setSelSize(newSize)

    if (newSize) {
      // Si para esta talla hay UN solo color → auto-seleccionarlo
      const colorsForNewSize = model.variants
        .filter(v => v.size === newSize)
        .map(v => v.color)
        .filter(Boolean) as string[]
      const uniqueColors = [...new Set(colorsForNewSize)]
      if (uniqueColors.length === 1) {
        setSelColor(uniqueColors[0])
      } else if (selColor && !colorsForNewSize.includes(selColor)) {
        // El color actual no existe para esta talla → limpiarlo
        setSelColor(null)
      }
    }
  }

  // ── Agregar al carrito ────────────────────────────────────────────────────
  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()

    // 1. Verificar que se haya elegido talla (cuando hay múltiples)
    if (model.size_names.length > 1 && !selSize) {
      toast.warning('Selecciona una talla primero', { duration: 2000 })
      return
    }
    // 2. Verificar que se haya elegido color (cuando hay múltiples)
    if (model.colors.length > 1 && !selColor) {
      toast.warning('Selecciona un color primero', { duration: 2000 })
      return
    }
    // 3. La combinación seleccionada no existe en inventario
    if (!matchingVariant) {
      const combo = [selSize, selColor].filter(Boolean).join(' / ')
      toast.error(`La combinación "${combo}" no existe`, { duration: 2500 })
      return
    }
    // 4. Sin stock para esa variante
    if (matchingVariant.stock <= 0) {
      const combo = [matchingVariant.size, matchingVariant.color].filter(Boolean).join(' / ')
      toast.error(`Sin stock para ${combo || 'esta variante'}`, { duration: 2000 })
      return
    }

    onAddToCart(matchingVariant)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
  }

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 p-0 relative flex flex-col">
      {/* ── Image ── */}
      <div
        className="relative aspect-[3/4] bg-muted overflow-hidden cursor-pointer flex-shrink-0"
        onClick={onOpenDetail}
      >
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={displayImage}
            src={displayImage}
            alt={selColor ? `${model.base_name} — ${selColor}` : model.base_name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/30">
            <ImageIcon className="h-8 w-8" />
            <span className="text-[9px]">Sin imagen</span>
          </div>
        )}

        {/* Stock badge */}
        <div className="absolute top-1.5 right-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/90 shadow-sm ${stockBadgeColor}`}>
            {model.total_stock > 0 ? `${model.total_stock} uds` : 'Agotado'}
          </span>
        </div>

        {/* In-cart indicator */}
        {isInCart && (
          <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
            <ShoppingCart className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="p-2 flex flex-col gap-1.5 flex-1">
        {/* Title — click opens detail */}
        <div onClick={onOpenDetail} className="cursor-pointer">
          <p className="text-[9px] font-mono text-muted-foreground leading-none">{model.base_code}</p>
          <p className="text-xs font-semibold leading-tight line-clamp-2 mt-0.5">{model.base_name}</p>
          {model.brand_name && (
            <p className="text-[9px] text-muted-foreground mt-0.5">{model.brand_name}</p>
          )}
        </div>

        {/* Colors — clickable dots, greyed out if not compatible with selected size */}
        {model.colors.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {model.colors.slice(0, 7).map(c => {
              const isDisabled = !colorsForSelSize.has(c)
              const hasImage = !!model.color_images[c.toLowerCase()]
              return (
                <span key={c} className="relative inline-flex">
                  <ColorDot
                    color={c}
                    size="md"
                    selected={selColor === c}
                    disabled={isDisabled}
                    onClick={isDisabled ? undefined : e => handleColorClick(e, c)}
                  />
                  {/* Indicador de foto vinculada */}
                  {hasImage && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-white flex items-center justify-center shadow-sm"
                      title={`Foto vinculada: ${c}`}
                    >
                      <Camera className="w-1.5 h-1.5 text-primary" />
                    </span>
                  )}
                </span>
              )
            })}
            {model.colors.length > 7 && (
              <span className="text-[9px] text-muted-foreground">+{model.colors.length - 7}</span>
            )}
          </div>
        )}

        {/* Size chips — greyed out if not compatible with selected color */}
        {model.size_names.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {model.size_names.slice(0, 7).map(s => {
              const existsForColor = sizesForSelColor.has(s)
              // Tiene stock considerando el color seleccionado
              const vForSize = model.variants.filter(v =>
                v.size === s && (selColor ? v.color === selColor : true)
              )
              const hasStock = vForSize.some(v => v.stock > 0)
              const isSel = selSize === s
              const isDisabled = !existsForColor

              return (
                <button
                  key={s}
                  onClick={e => { if (!isDisabled) handleSizeClick(e, s) }}
                  disabled={isDisabled}
                  className={[
                    'text-[9px] px-1.5 py-0.5 rounded font-mono transition-all leading-none',
                    isSel
                      ? 'bg-primary text-primary-foreground font-bold'
                      : isDisabled
                        ? 'bg-muted/20 text-muted-foreground/25 line-through cursor-not-allowed'
                        : !hasStock
                          ? 'bg-muted/20 text-muted-foreground/40 line-through cursor-not-allowed'
                          : 'bg-muted hover:bg-muted/70 cursor-pointer',
                  ].join(' ')}
                >
                  {s}
                </button>
              )
            })}
            {model.size_names.length > 7 && (
              <span className="text-[9px] text-muted-foreground px-0.5">+{model.size_names.length - 7}</span>
            )}
          </div>
        )}

        {/* Guía de selección: le indica al usuario qué falta o qué se va a agregar */}
        <p className="text-[9px] leading-none min-h-[10px]">
          {!selSize && model.size_names.length > 1 ? (
            <span className="text-amber-500/80">↑ elige talla</span>
          ) : !selColor && model.colors.length > 1 ? (
            <span className="text-amber-500/80">↑ elige color</span>
          ) : !matchingVariant ? (
            <span className="text-rose-500/70">combinación no disponible</span>
          ) : matchingVariant.stock <= 0 ? (
            <span className="text-rose-500/70">sin stock en esta variante</span>
          ) : (
            <span className="text-emerald-600/80 font-medium">
              {[matchingVariant.size, matchingVariant.color].filter(Boolean).join(' · ')}
              {matchingVariant.stock < 5 && (
                <span className="text-amber-500 ml-1">· {matchingVariant.stock} uds</span>
              )}
            </span>
          )}
        </p>

        {/* Price + Add button */}
        <div className="flex items-center justify-between gap-1 mt-auto pt-1">
          <span className="text-xs font-bold tabular-nums">{formatCurrency(model.sale_price)}</span>
          <button
            onClick={handleAdd}
            title={model.total_stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
            disabled={model.total_stock === 0}
            className={[
              'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-200',
              justAdded
                ? 'bg-emerald-500 text-white scale-110'
                : model.total_stock === 0
                  ? 'bg-muted text-muted-foreground/30 cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110 active:scale-95',
            ].join(' ')}
          >
            {justAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, bold }: { label: string; value: string | null | undefined; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs text-right ${bold ? 'font-bold text-foreground' : 'text-foreground'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function ModelDetailModal({
  model,
  open,
  onClose,
  onRefresh,
  onAddToCart,
}: {
  model: ModelCard | null
  open: boolean
  onClose: () => void
  onRefresh: () => void
  onAddToCart: (variant: ModelVariant) => void
}) {
  const [images, setImages] = useState<ProductImage[]>([])
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadColor, setUploadColor] = useState('')
  const [uploadAsPrimary, setUploadAsPrimary] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // Color-image linking: when set, gallery shows images tagged with that color (+ untagged)
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  // Edit color of existing image
  const [editingColor, setEditingColor] = useState(false)
  const [editColorValue, setEditColorValue] = useState('')
  const [savingColor, setSavingColor] = useState(false)

  const loadImages = useCallback(async (m: ModelCard) => {
    const supabase = createBrowserClient()
    try {
      const { data } = await supabase
        .from('product_images')
        .select('id, base_code, color, is_primary, public_url, storage_path')
        .eq('base_code', m.base_code)
        .order('is_primary', { ascending: false })
        .order('sort_order')
      let imgs = (data || []) as ProductImage[]
      // Fallback: if no product_images row, use products.image_url
      if (imgs.length === 0 && m.primary_image_url) {
        imgs = [{
          id: '__fallback__',
          base_code: m.base_code,
          color: null,
          is_primary: true,
          public_url: m.primary_image_url,
          storage_path: '',
        }]
      }
      setImages(imgs)
    } catch {
      if (m.primary_image_url) {
        setImages([{
          id: '__fallback__',
          base_code: m.base_code,
          color: null,
          is_primary: true,
          public_url: m.primary_image_url,
          storage_path: '',
        }])
      } else {
        setImages([])
      }
    }
  }, [])

  useEffect(() => {
    if (model && open) {
      loadImages(model)
      setGalleryIdx(0)
      setColorFilter(null)
    }
  }, [model?.base_code, open, loadImages])

  // Compute which images to show based on color filter
  const displayImages = useMemo(() => {
    if (!colorFilter) return images
    // Show images tagged for this color + untagged (generic) images
    const filtered = images.filter(
      i => !i.color || i.color.toLowerCase() === colorFilter.toLowerCase()
    )
    return filtered.length > 0 ? filtered : images
  }, [images, colorFilter])

  // Jump gallery to first image for selected color
  useEffect(() => {
    if (!colorFilter) { setGalleryIdx(0); return }
    const idx = displayImages.findIndex(
      i => i.color?.toLowerCase() === colorFilter.toLowerCase()
    )
    setGalleryIdx(idx !== -1 ? idx : 0)
  }, [colorFilter, displayImages])

  // Reset color editor when gallery changes
  useEffect(() => { setEditingColor(false) }, [galleryIdx])

  // Map color → count of tagged images for the camera indicator
  const imagesPerColor = useMemo(() => {
    const map: Record<string, number> = {}
    images.forEach(img => { if (img.color) map[img.color.toLowerCase()] = (map[img.color.toLowerCase()] || 0) + 1 })
    return map
  }, [images])

  const handleUpload = useCallback(async (file: File) => {
    if (!model) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('base_code', model.base_code)
      if (uploadColor) fd.append('color', uploadColor)
      fd.append('is_primary', String(uploadAsPrimary))
      const res  = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        toast.success('Imagen subida correctamente')
        await loadImages(model)
        onRefresh()
      } else {
        toast.error(json.error || 'Error al subir imagen')
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [model, uploadColor, uploadAsPrimary, loadImages, onRefresh])

  const handleSetPrimary = useCallback(async (imgId: string) => {
    if (!model || imgId === '__fallback__') return
    const supabase = createBrowserClient()
    // @ts-ignore - product_images table types not yet generated
    await supabase.from('product_images').update({ is_primary: false })
      .eq('base_code', model.base_code).is('color', null)
    // @ts-ignore - product_images table types not yet generated
    await supabase.from('product_images').update({ is_primary: true }).eq('id', imgId)
    await loadImages(model)
    onRefresh()
    toast.success('Imagen marcada como principal')
  }, [model, loadImages, onRefresh])

  const handleDelete = useCallback(async (imgId: string) => {
    if (imgId === '__fallback__') return
    if (!confirm('¿Eliminar esta imagen?')) return
    const res  = await fetch(`/api/upload/product-image?id=${imgId}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      toast.success('Imagen eliminada')
      setImages(prev => prev.filter(i => i.id !== imgId))
      setGalleryIdx(0)
      onRefresh()
    } else {
      toast.error(json.error || 'Error al eliminar')
    }
  }, [onRefresh])

  const handleSaveColor = useCallback(async (imgId: string) => {
    if (imgId === '__fallback__') return
    setSavingColor(true)
    try {
      const res  = await fetch(`/api/upload/product-image?id=${imgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: editColorValue.trim() || null }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editColorValue.trim() ? `Color asignado: ${editColorValue}` : 'Color removido')
        setImages(prev => prev.map(i =>
          i.id === imgId ? { ...i, color: editColorValue.trim() || null } : i
        ))
        setEditingColor(false)
        onRefresh()
      } else {
        toast.error(json.error || 'Error al guardar color')
      }
    } finally {
      setSavingColor(false)
    }
  }, [editColorValue, onRefresh])

  // Early return AFTER all hooks
  if (!model) return null
  
  const currentImg = displayImages[galleryIdx]
  const showMultiColor = model.colors.length > 1

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2 flex-wrap">
            <span className="font-mono text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded">{model.base_code}</span>
            <span>{model.base_name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Gallery ── */}
          <div className="space-y-3">
            {/* Color filter indicator */}
            {colorFilter && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="h-3 w-3" />
                <span>Fotos de color:</span>
                <div className="flex items-center gap-1">
                  <ColorDot color={colorFilter} size="sm" />
                  <span className="font-medium text-foreground">{colorFilter}</span>
                </div>
                <button
                  onClick={() => setColorFilter(null)}
                  className="ml-auto text-[10px] text-primary hover:underline"
                >
                  Ver todas
                </button>
              </div>
            )}

            <div className="relative aspect-[3/4] rounded-lg bg-muted overflow-hidden">
              {currentImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImg.public_url}
                  alt={model.base_name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                  <ImageIcon className="h-16 w-16" />
                </div>
              )}
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryIdx(i => (i - 1 + displayImages.length) % displayImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setGalleryIdx(i => (i + 1) % displayImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              {/* Badges: Principal + color tag */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {currentImg?.is_primary && (
                  <div className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Star className="h-2.5 w-2.5" /> Principal
                  </div>
                )}
                {currentImg?.color && (
                  <div className="bg-white/90 text-foreground text-[9px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                    <ColorDot color={currentImg.color} size="sm" />
                    {currentImg.color}
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {displayImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setGalleryIdx(idx)}
                    className={`relative w-14 h-14 rounded flex-shrink-0 overflow-hidden border-2 transition-all ${
                      idx === galleryIdx ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.public_url} alt="" className="w-full h-full object-cover" />
                    {/* Color tag indicator on thumbnail */}
                    {img.color && (
                      <div className="absolute bottom-0 right-0 m-0.5">
                        <ColorDot color={img.color} size="sm" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Image actions */}
            {currentImg && currentImg.id !== '__fallback__' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleSetPrimary(currentImg.id)}
                    disabled={currentImg.is_primary}
                  >
                    <Star className="h-3 w-3" />
                    {currentImg.is_primary ? 'Principal ✓' : 'Marcar principal'}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(currentImg.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Color tag editor */}
                {editingColor ? (
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Ej: Azul, Rojo…"
                      value={editColorValue}
                      onChange={e => setEditColorValue(e.target.value)}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveColor(currentImg.id) }}
                    />
                    <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => handleSaveColor(currentImg.id)} disabled={savingColor}>
                      {savingColor ? '…' : 'OK'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingColor(false)}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditColorValue(currentImg.color || ''); setEditingColor(true) }}
                    className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Camera className="h-3 w-3" />
                    {currentImg.color
                      ? <><ColorDot color={currentImg.color} size="sm" /><span>Color: <strong>{currentImg.color}</strong> (editar)</span></>
                      : <span>Sin color asignado — <span className="text-primary underline">Asignar color</span></span>
                    }
                  </button>
                )}
              </div>
            )}

            {/* Upload */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Subir nueva imagen</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Color (opcional)</Label>
                  <Input
                    placeholder="Ej: Rojo"
                    value={uploadColor}
                    onChange={e => setUploadColor(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={uploadAsPrimary}
                      onChange={e => setUploadAsPrimary(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    Principal
                  </label>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
              />
              <Button
                size="sm" variant="outline" className="w-full gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Subiendo…' : 'Elegir archivo…'}
              </Button>
            </div>
          </div>

          {/* ── Product Info + Variants ── */}
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Información del modelo</p>
              <InfoRow label="Línea"      value={model.line_name} />
              <InfoRow label="Categoría"  value={model.category_name} />
              <InfoRow label="Marca"      value={model.brand_name} />
              <InfoRow label="P. Compra"  value={formatCurrency(model.purchase_price)} />
              <InfoRow label="P. Venta"   value={formatCurrency(model.sale_price)} bold />
              <InfoRow label="Variantes"  value={`${model.variant_count} variante${model.variant_count !== 1 ? 's' : ''}`} />
            </div>

            {/* Variants table with real stock */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Tallas y stock</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[10px] uppercase">Talla</th>
                      {showMultiColor && (
                        <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[10px] uppercase">Color</th>
                      )}
                      <th className="px-3 py-1.5 text-right font-semibold text-muted-foreground text-[10px] uppercase">Stock</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-muted-foreground text-[10px] uppercase">Estado</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {model.variants.length > 0 ? (
                      model.variants.map((v, i) => (
                        <tr key={v.product_id} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                          <td className="px-3 py-1.5 font-mono font-semibold">{v.size || '—'}</td>
                          {showMultiColor && (
                            <td className="px-3 py-1.5">
                              {v.color ? (
                                <div className="flex items-center gap-1.5">
                                  <ColorDot color={v.color} size="sm" />
                                  <span className="text-[10px] text-muted-foreground">{v.color}</span>
                                </div>
                              ) : '—'}
                            </td>
                          )}
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{v.stock}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              v.stock === 0 ? 'bg-rose-100 text-rose-700' :
                              v.stock < 5  ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {v.stock === 0 ? 'Agotado' : v.stock < 5 ? 'Poco' : 'Ok'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => {
                                if (v.stock > 0) {
                                  onAddToCart(v)
                                  toast.success('Agregado al carrito', { duration: 1500 })
                                }
                              }}
                              disabled={v.stock === 0}
                              title={v.stock > 0 ? 'Agregar al carrito' : 'Sin stock'}
                              className={`h-5 w-5 rounded-full flex items-center justify-center transition-all mx-auto ${
                                v.stock > 0
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110'
                                  : 'bg-muted text-muted-foreground/30 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={showMultiColor ? 5 : 4} className="px-3 py-3 text-center text-muted-foreground text-xs">
                          Sin variantes registradas
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2 border-border">
                      <td
                        className="px-3 py-1.5 font-semibold text-[10px] uppercase text-muted-foreground"
                        colSpan={showMultiColor ? 2 : 1}
                      >
                        Total
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums">{model.total_stock}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Colors summary — clickable to filter gallery images */}
            {model.colors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Colores disponibles</p>
                  {colorFilter && (
                    <button
                      onClick={() => setColorFilter(null)}
                      className="text-[9px] text-primary hover:underline ml-auto"
                    >
                      Ver todas las fotos
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {model.colors.map(c => {
                    const hasImages = (imagesPerColor[c.toLowerCase()] ?? 0) > 0
                    const isSelected = colorFilter === c
                    return (
                      <button
                        key={c}
                        onClick={() => setColorFilter(isSelected ? null : c)}
                        className={[
                          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors',
                          isSelected
                            ? 'bg-primary/10 ring-1 ring-primary text-foreground'
                            : 'hover:bg-muted text-muted-foreground',
                        ].join(' ')}
                        title={hasImages ? `Ver fotos de ${c}` : `${c} (sin fotos)`}
                      >
                        <ColorDot color={c} size="md" selected={isSelected} />
                        <span>{c}</span>
                        {hasImages && (
                          <Camera className="h-2.5 w-2.5 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
                {model.colors.some(c => (imagesPerColor[c.toLowerCase()] ?? 0) > 0) && (
                  <p className="text-[9px] text-muted-foreground/60 mt-1.5">
                    Haz clic en un color con <Camera className="inline h-2 w-2" /> para ver sus fotos
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  items,
  open,
  onClose,
  onUpdateQty,
  onRemove,
  onClear,
  onGoToPOS,
}: {
  items: VisualCartItem[]
  open: boolean
  onClose: () => void
  onUpdateQty: (product_id: string, qty: number) => void
  onRemove: (product_id: string) => void
  onClear: () => void
  onGoToPOS: () => void
}) {
  const total    = items.reduce((s, i) => s + i.subtotal, 0)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  return (
    /* Inline side panel — no backdrop, no fixed position, just flex sibling */
    <div
      className={`flex-shrink-0 border-l bg-background flex flex-col overflow-hidden
        transition-[width] duration-300 ease-in-out ${open ? 'w-80' : 'w-0'}`}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-foreground" />
            <span className="font-semibold text-sm">Carrito</span>
            {totalQty > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
                {totalQty}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <Button
                size="sm" variant="ghost"
                onClick={onClear}
                className="h-7 text-xs text-muted-foreground gap-1 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Vaciar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40">
              <ShoppingCart className="h-10 w-10 mb-2" />
              <p className="text-xs">Carrito vacío</p>
              <p className="text-[10px] mt-1">Agrega productos desde el catálogo</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.product_id} className="flex gap-2 p-2 rounded-lg border bg-card">
                {/* Thumbnail */}
                <div className="w-11 h-11 rounded overflow-hidden flex-shrink-0 bg-muted">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.base_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-[11px] font-semibold leading-tight truncate">{item.base_name}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {item.size && (
                      <span className="text-[9px] bg-muted px-1 py-0.5 rounded font-mono leading-none">{item.size}</span>
                    )}
                    {item.color && (
                      <div className="flex items-center gap-0.5">
                        <ColorDot color={item.color} size="sm" />
                        <span className="text-[9px] text-muted-foreground">{item.color}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(item.unit_price)} c/u</p>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    onClick={() => onRemove(item.product_id)}
                    className="text-muted-foreground/30 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
                      className="h-5 w-5 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-xs font-bold w-5 text-center tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQty(item.product_id, item.quantity + 1)}
                      className="h-5 w-5 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-xs font-bold tabular-nums">{formatCurrency(item.subtotal)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {totalQty} producto{totalQty !== 1 ? 's' : ''}
            </span>
            <span className="text-lg font-bold tabular-nums">{formatCurrency(total)}</span>
          </div>
          {items.length > 0 ? (
            <Button onClick={onGoToPOS} className="w-full gap-2 h-10 font-semibold">
              <ArrowRight className="h-4 w-4" />
              Ir al POS
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full h-10">
              Seguir viendo
            </Button>
          )}
        </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VisualCatalog() {
  const router = useRouter()
  const { selectedStore, storeId } = useStore()

  // ── Data ───────────────────────────────────────────────────────────────────
  const [models,     setModels]     = useState<ModelCard[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lines,      setLines]      = useState<FilterOption[]>([])
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [brands,     setBrands]     = useState<FilterOption[]>([])

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [filterLine,      setFilterLine]      = useState('all')
  const [filterCategory,  setFilterCategory]  = useState('all')
  const [filterBrand,     setFilterBrand]     = useState('all')
  const [filterColor,     setFilterColor]     = useState('')
  const [page,            setPage]            = useState(1)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selected,  setSelected]  = useState<ModelCard | null>(null)
  const [cartOpen,  setCartOpen]  = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false) // Mobile filters bottom sheet
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('name')

  // ── Cart ───────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<VisualCartItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setCartItems(Array.isArray(parsed) ? parsed : [])
      }
    } catch (err) {
      console.error('[VisualCatalog] Error loading cart:', err)
    } finally {
      setCartLoaded(true)
    }
  }, [])

  // Persist cart to localStorage on change (only after initial load)
  useEffect(() => {
    if (!cartLoaded) return
    try {
      if (cartItems.length > 0) {
        localStorage.setItem(CART_KEY, JSON.stringify(cartItems))
      } else {
        localStorage.removeItem(CART_KEY)
      }
    } catch (err) {
      console.error('[VisualCatalog] Error saving cart:', err)
    }
  }, [cartItems, cartLoaded])

  const addToCart = useCallback((model: ModelCard, variant: ModelVariant) => {
    setCartItems(prev => {
      const idx = prev.findIndex(i => i.product_id === variant.product_id)
      if (idx >= 0) {
        const updated = [...prev]
        const existing = updated[idx]
        updated[idx] = {
          ...existing,
          quantity: existing.quantity + 1,
          subtotal: (existing.quantity + 1) * existing.unit_price,
        }
        return updated
      }
      return [...prev, {
        product_id:   variant.product_id,
        product_name: variant.size ? `${model.base_name} - ${variant.size}` : model.base_name,
        barcode:      variant.barcode,
        quantity:     1,
        unit_price:   variant.price,
        subtotal:     variant.price,
        image_url:    model.primary_image_url,
        size:         variant.size,
        color:        variant.color,
        base_name:    model.base_name,
      }]
    })
  }, [])

  const removeFromCart = useCallback((product_id: string) => {
    setCartItems(prev => prev.filter(i => i.product_id !== product_id))
  }, [])

  const updateCartQty = useCallback((product_id: string, qty: number) => {
    if (qty <= 0) { removeFromCart(product_id); return }
    setCartItems(prev => prev.map(i =>
      i.product_id === product_id
        ? { ...i, quantity: qty, subtotal: qty * i.unit_price }
        : i
    ))
  }, [removeFromCart])

  const clearCart = useCallback(() => {
    setCartItems([])
    try { localStorage.removeItem(CART_KEY) } catch { /* ignore */ }
  }, [])

  const goToPOS = useCallback(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)) } catch { /* ignore */ }
    router.push('/pos')
  }, [cartItems, router])

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (activeStoreId: string | null) => {
    setLoading(true)
    const supabase = createBrowserClient()

    // 1. Get user's stores (TEXT array like ['MUJERES', 'HOMBRES'])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('stores')
      .eq('id', user.id)
      .single()

    const userStores = userProfile?.stores || []

    // 2. Get store UUIDs from store codes
    let storeIds: string[] = []
    if (userStores.length > 0) {
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .in('code', userStores)

      storeIds = (stores || []).map(s => s.id)
    }

    // 2b. If a specific store is selected globally, restrict to that store only
    if (activeStoreId) {
      storeIds = storeIds.includes(activeStoreId)
        ? [activeStoreId]   // user has access to that store
        : [activeStoreId]   // respect global selection regardless
    }

    // 3. Get lines available for these stores (via line_stores)
    let availableLineIds: string[] = []
    if (storeIds.length > 0) {
      const { data: lineStores } = await supabase
        .from('line_stores')
        .select('line_id')
        .in('store_id', storeIds)

      availableLineIds = (lineStores || []).map(ls => ls.line_id)
    }

    // 4. Load lines filtered by stores
    const linesQuery = supabase
      .from('lines')
      .select('id, name')
      .eq('active', true)
      .order('name')

    if (availableLineIds.length > 0) {
      linesQuery.in('id', availableLineIds)
    }

    const [linesRes, catsRes, brandsRes] = await Promise.all([
      linesQuery,
      supabase.from('categories').select('id, name').eq('active', true).order('name'),
      supabase.from('brands').select('id, name').eq('active', true).order('name'),
    ])
    
    setLines(linesRes.data || [])
    setCategories(catsRes.data || [])
    setBrands(brandsRes.data || [])

    // 5. Load products filtered by available lines
    const productsQuery = supabase
      .from('products')
      .select(`
        id, barcode, name, size, color, base_code, base_name,
        purchase_price, price, category_id, brand_id, line_id,
        image_url, entry_date,
        categories ( id, name, line_id, lines ( id, name ) ),
        brands ( id, name ),
        stock ( quantity )
      `)
      .eq('active', true)
      .order('base_code', { nullsFirst: false })
      .limit(2000)

    // Filter by available lines if user has stores
    if (availableLineIds.length > 0) {
      productsQuery.in('line_id', availableLineIds)
    }

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      console.error('[VisualCatalog] Products error:', productsError)
      setLoading(false)
      return
    }

    // ── Group by derived base_code from barcode ──────────────────────────
    // Barcode format: "{baseCode}-{sizeName}" e.g. "CHA-L" → group "CHA"
    const grouped: Record<string, ModelCard> = {}

    for (const p of products || []) {
      const pAny = p as any

      // Use explicit base_code when present (populated by migration/bulk-entry).
      // Fall back to stripping the last -SEGMENT from barcode for legacy data.
      const groupKey: string =
        (pAny.base_code as string | null)?.trim() ||
        (pAny.barcode
          ? (pAny.barcode as string).replace(/-[^-]+$/, '')
          : pAny.id)

      // Use explicit base_name when present; fall back to stripping " - SIZE" suffix.
      const displayName: string =
        (pAny.base_name as string | null)?.trim() ||
        (pAny.name
          ? (pAny.name as string).replace(/ - [^-\s][^-]*$/, '').trim()
          : '(sin nombre)')

      const cat   = pAny.categories as any
      const brand = pAny.brands     as any
      const line  = cat?.lines      as any

      // Compute this variant's stock
      const stockArr: any[] = Array.isArray(pAny.stock)
        ? pAny.stock
        : (pAny.stock ? [pAny.stock] : [])
      const variantStock = stockArr.reduce((s: number, st: any) => s + (Number(st.quantity) || 0), 0)

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          base_code:      groupKey,
          base_name:      displayName,
          category_id:    pAny.category_id  ?? null,
          category_name:  cat?.name         ?? null,
          line_id:        pAny.line_id ?? cat?.line_id ?? null,
          line_name:      line?.name         ?? null,
          brand_id:       pAny.brand_id     ?? null,
          brand_name:     brand?.name        ?? null,
          sale_price:     Number(pAny.price         ?? 0),
          purchase_price: Number(pAny.purchase_price ?? 0),
          total_stock:    0,
          variant_count:  0,
          size_names:     [],
          colors:         [],
          primary_image_url: pAny.image_url ?? null,
          color_images:   {},
          variants:       [],
        }
      }

      const g = grouped[groupKey]
      g.total_stock   += variantStock
      g.variant_count += 1

      // Use the first non-null image_url found in the group
      if (pAny.image_url && !g.primary_image_url) {
        g.primary_image_url = pAny.image_url as string
      }

      const sizeText: string | null = pAny.size ?? null
      const colorText: string | null = pAny.color ?? null

      if (sizeText  && !g.size_names.includes(sizeText))  g.size_names.push(sizeText)
      if (colorText && !g.colors.includes(colorText))     g.colors.push(colorText)

      g.variants.push({
        product_id:     pAny.id as string,
        barcode:        (pAny.barcode as string) || groupKey,
        size:           sizeText,
        color:          colorText,
        stock:          variantStock,
        price:          Number(pAny.price         ?? 0),
        purchase_price: Number(pAny.purchase_price ?? 0),
      })
    }

    // ── Override primary images + build color_images map ────────────────
    const baseCodes = Object.keys(grouped)
    if (baseCodes.length > 0) {
      try {
        const { data: imgs, error: imgErr } = await supabase
          .from('product_images')
          .select('base_code, public_url, is_primary, color')
          .in('base_code', baseCodes)
          .order('is_primary', { ascending: false })  // primarias primero
          .order('sort_order' as any)

        if (!imgErr && imgs) {
          for (const img of imgs) {
            const imgAny = img as any
            const group = grouped[imgAny.base_code]
            if (!group || !imgAny.public_url) continue

            // Imagen primaria → sobrescribe primary_image_url
            if (imgAny.is_primary) {
              group.primary_image_url = imgAny.public_url as string
            }

            // Imagen con color etiquetado → guardar en mapa color_images
            // Solo guarda la primera imagen encontrada por color (is_primary primero)
            if (imgAny.color) {
              const colorKey = (imgAny.color as string).toLowerCase()
              if (!group.color_images[colorKey]) {
                group.color_images[colorKey] = imgAny.public_url as string
              }
            }

            // Fallback: si aún no hay primary_image_url, usar la primera imagen disponible
            if (!group.primary_image_url) {
              group.primary_image_url = imgAny.public_url as string
            }
          }
        }
      } catch (err) {
        // Silently ignore if product_images table doesn't exist
      }
    }

    // ── Sort sizes and variants ──────────────────────────────────────────
    const result = Object.values(grouped)
    result.forEach(m => {
      m.size_names = sortSizes(m.size_names)
      m.variants.sort((a, b) => {
        const ai = SIZE_ORDER.indexOf((a.size ?? '').toUpperCase())
        const bi = SIZE_ORDER.indexOf((b.size ?? '').toUpperCase())
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return (a.size ?? '').localeCompare(b.size ?? '', undefined, { numeric: true })
      })
    })

    setModels(result)
    setLoading(false)
  }, [])

  // Recargar cuando cambie la tienda seleccionada globalmente
  useEffect(() => {
    loadData(storeId)
    setFilterLine('all')
    setFilterCategory('all')
    setPage(1)
  }, [loadData, storeId])

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = models
    if (filterLine     !== 'all') out = out.filter(m => m.line_id     === filterLine)
    if (filterCategory !== 'all') out = out.filter(m => m.category_id === filterCategory)
    if (filterBrand    !== 'all') out = out.filter(m => m.brand_id    === filterBrand)
    if (filterColor)              out = out.filter(m => m.colors.some(c => c.toLowerCase().includes(filterColor.toLowerCase())))
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(m =>
        m.base_code.toLowerCase().includes(q)     ||
        m.base_name.toLowerCase().includes(q)     ||
        (m.brand_name?.toLowerCase().includes(q)  ?? false) ||
        (m.category_name?.toLowerCase().includes(q) ?? false)
      )
    }
    return out
  }, [models, filterLine, filterCategory, filterBrand, filterColor, search])

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortBy) {
      case 'name':
        return arr.sort((a, b) => a.base_name.localeCompare(b.base_name))
      case 'recent':
        return arr.sort((a, b) => b.base_code.localeCompare(a.base_code)) // Assuming newer codes are higher
      case 'price-asc':
        return arr.sort((a, b) => a.sale_price - b.sale_price)
      case 'price-desc':
        return arr.sort((a, b) => b.sale_price - a.sale_price)
      case 'stock':
        return arr.sort((a, b) => b.total_stock - a.total_stock)
      default:
        return arr
    }
  }, [filtered, sortBy])

  // ── Statistics ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalModels = models.length
    const totalUnits = models.reduce((sum, m) => sum + m.total_stock, 0)
    const outOfStock = models.filter(m => m.total_stock === 0).length
    // "Nuevos hoy" — modelos con entry_date = hoy
    const todayStr = new Date().toISOString().split('T')[0]
    const newToday = models.filter(m =>
      m.variants.some(v => (v as any).entry_date && String((v as any).entry_date).startsWith(todayStr))
    ).length

    return { totalModels, totalUnits, outOfStock, newToday }
  }, [models])

  const totalPages      = Math.ceil(sorted.length / ITEMS_PER_PAGE)
  const paginated       = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const cartCount       = cartItems.reduce((s, i) => s + i.quantity, 0)
  const cartProductIds  = useMemo(() => new Set(cartItems.map(i => i.product_id)), [cartItems])
  const hasFilters      = search || filterLine !== 'all' || filterCategory !== 'all' || filterBrand !== 'all' || filterColor

  const resetFilters = () => {
    setSearch(''); setFilterLine('all'); setFilterCategory('all')
    setFilterBrand('all'); setFilterColor(''); setPage(1)
  }

  // Filters component (reusable for sidebar and modal)
  const FiltersContent = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-1.5">Línea</Label>
        <Select value={filterLine} onValueChange={v => { setFilterLine(v); setPage(1) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas las líneas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las líneas</SelectItem>
            {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-1.5">Categoría</Label>
        <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-1.5">Marca</Label>
        <Select value={filterBrand} onValueChange={v => { setFilterBrand(v); setPage(1) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-1.5">Color</Label>
        <Input
          placeholder="Buscar color..."
          value={filterColor}
          onChange={e => { setFilterColor(e.target.value); setPage(1) }}
          className="h-8 text-xs"
        />
      </div>

      {hasFilters && (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={resetFilters} 
          className="w-full h-8 gap-1.5 text-xs"
        >
          <X className="h-3 w-3" /> Limpiar filtros
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col bg-background" style={{ height: 'calc(100dvh - 9.5rem)' }}>

      {/* ── Statistics Bar ──────────────────────────────────────────────────── */}
      <div className="border-b bg-muted/30 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{stats.totalModels}</span>
            <span className="text-muted-foreground">Modelos</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold">{stats.totalUnits}</span>
            <span className="text-muted-foreground">Unidades</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            <span className="font-semibold">{stats.outOfStock}</span>
            <span className="text-muted-foreground">sin stock</span>
          </div>
          {stats.newToday > 0 && (
            <>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">{stats.newToday}</span>
                <span className="text-muted-foreground">nuevos hoy</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Top bar: search + inline filters (desktop) + cart toggle ────────── */}
      <div className="border-b px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Mobile: Filters button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden h-8 px-3 flex-shrink-0 gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasFilters && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">
                {[filterLine !== 'all', filterCategory !== 'all', filterBrand !== 'all', filterColor].filter(Boolean).length}
              </Badge>
            )}
          </Button>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nombre, código, marca..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Desktop inline filters */}
          <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
            <Select value={filterLine} onValueChange={v => { setFilterLine(v); setPage(1) }}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Línea" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las líneas</SelectItem>
                {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1) }}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Categoría</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterBrand} onValueChange={v => { setFilterBrand(v); setPage(1) }}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Marca</SelectItem>
                {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Input
              placeholder="Color..."
              value={filterColor}
              onChange={e => { setFilterColor(e.target.value); setPage(1) }}
              className="h-8 text-xs w-24"
            />

            {hasFilters && (
              <Button
                size="sm" variant="ghost"
                onClick={resetFilters}
                className="h-8 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" /> Limpiar
              </Button>
            )}
          </div>

          {/* Right: count + cart */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="relative h-8 px-3 rounded-md flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title={cartOpen ? 'Ocultar carrito' : 'Mostrar carrito'}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{cartOpen ? 'Ocultar' : 'Carrito'}</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Filters Bottom Sheet ──────────────────────────────────────── */}
      {filtersOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-background border-t rounded-t-2xl z-50 lg:hidden max-h-[80vh] overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Filtros</h3>
                <Button size="sm" variant="ghost" onClick={() => setFiltersOpen(false)} className="h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FiltersContent />
            </div>
          </div>
        </>
      )}

      {/* ── Main area: grid + cart drawer side by side ──────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Grid area */}
        <div className="flex-1 overflow-auto p-4">
          
          {/* ── View Controls & Sort ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            {/* Left: Results info */}
            <div className="text-xs text-muted-foreground">
              Mostrando <span className="font-semibold text-foreground">{sorted.length}</span> modelo{sorted.length !== 1 ? 's' : ''}
              {' · '}
              <span className="font-semibold text-foreground">
                {sorted.reduce((sum, m) => sum + m.total_stock, 0)}
              </span> unidades totales
            </div>

            {/* Right: View mode + Sort */}
            <div className="flex items-center gap-3">
              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`h-7 px-2.5 rounded flex items-center gap-1.5 text-xs transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Vista Grid"
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`h-7 px-2.5 rounded flex items-center gap-1.5 text-xs transition-colors ${
                    viewMode === 'list'
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Vista Lista"
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Lista</span>
                </button>
              </div>

              {/* Sort dropdown */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre A-Z</SelectItem>
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="price-asc">Precio: Menor</SelectItem>
                  <SelectItem value="price-desc">Precio: Mayor</SelectItem>
                  <SelectItem value="stock">Mayor stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Grid ──────────────────────────────────────────────────────────── */}
          {loading ? (
            <div className={`grid gap-3 ${
              viewMode === 'pos'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                : viewMode === 'list'
                  ? 'grid-cols-1'
                  : cartOpen
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
            }`}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl border overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-muted" />
                  <div className="p-2.5 space-y-1.5">
                    <div className="h-2 bg-muted rounded w-16" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-2 bg-muted rounded w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
              <Package className="h-12 w-12 mb-3" />
              <p className="text-sm">
                {hasFilters ? 'Sin resultados para los filtros aplicados' : 'No hay productos en el catálogo'}
              </p>
            </div>
          ) : (
            <>
              <div className={`grid gap-3 ${
                viewMode === 'pos'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                  : viewMode === 'list'
                    ? 'grid-cols-1'
                    : cartOpen
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
              }`}>
                {paginated.map(m => (
                  <ModelCardItem
                    key={m.base_code}
                    model={m}
                    onOpenDetail={() => setSelected(m)}
                    onAddToCart={variant => {
                      addToCart(m, variant)
                      toast.success(
                        `${m.base_name}${variant.size ? ` - ${variant.size}` : ''} agregado al carrito`,
                        { duration: 1500 }
                      )
                    }}
                    isInCart={m.variants.some(v => cartProductIds.has(v.product_id))}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Pág {page} / {totalPages}
                  </span>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Cart Drawer ────────────────────────────────────────────────────── */}
        <CartDrawer
          items={cartItems}
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateCartQty}
          onRemove={removeFromCart}
          onClear={clearCart}
          onGoToPOS={goToPOS}
        />
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      <ModelDetailModal
        model={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onRefresh={() => loadData(storeId)}
        onAddToCart={variant => {
          if (selected) {
            addToCart(selected, variant)
            toast.success(
              `${selected.base_name}${variant.size ? ` - ${variant.size}` : ''} agregado`,
              { duration: 1500 }
            )
          }
        }}
      />
    </div>
  )
}
