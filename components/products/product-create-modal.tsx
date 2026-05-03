'use client'

/**
 * ProductCreateModal — Unified product creation dialog
 *
 * Section 1: Base data (Name, Código base, Proveedor+, Marca+, Línea,
 *             Categoría+, Almacén) with inline searchable selects and
 *             quick-create (+) popovers.
 * Section 2: Variants table (barcode · talla · color · p.compra · p.venta · stock)
 *             with add/remove rows. Horizontally scrollable on small screens.
 * Image upload with preview.
 * Calls createBulkProducts under the hood.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CompactColorPicker } from '@/components/ui/color-picker'
import { createBulkProducts } from '@/actions/products'
import { createSupplier, createBrand, createCategory, createSize, linkBrandToSupplier } from '@/actions/catalogs'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  ImageIcon,
  AlertCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/contexts/store-context'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Option {
  id: string
  name: string
  line_id?: string
}

interface VariantRow {
  _key: string
  barcode: string
  size: string
  color: string
  purchase_price: string
  sale_price: string
  quantity: string
}

export interface ProductCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a base_code from the product name using the first 3 chars of the
 * first word + first 2 chars of each additional word, max 6 total.
 * "Blusa Achorada" → "BLUAC"  |  "Blusa Africana" → "BLUAF"  |  "Camisa Formal" → "CAMFO"
 */
function computeBaseCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 6).toUpperCase()
  const first = words[0].slice(0, 3)
  const rest  = words.slice(1).map(w => w.slice(0, 2)).join('')
  return (first + rest).slice(0, 6).toUpperCase()
}

const WAREHOUSES = [
  { id: 'Tienda Mujeres', label: 'Tienda Mujeres' },
  { id: 'Tienda Hombres', label: 'Tienda Hombres' },
]

/** Infer warehouse from line name */
function warehouseFromLineName(lineName: string): string | null {
  const n = lineName.toLowerCase()
  if (n.includes('hombre')) return 'Tienda Hombres'
  if (n.includes('mujer') || n.includes('niño') || n.includes('nino')) return 'Tienda Mujeres'
  return null // shared lines (Accesorios, Perfumes) → don't override
}

let _rc = 0
function newRow(): VariantRow {
  return { _key: `r${++_rc}`, barcode: '', size: '', color: '', purchase_price: '', sale_price: '', quantity: '' }
}

// ── Searchable Select (no external deps) ─────────────────────────────────────

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  onQuickCreate?: (name: string) => Promise<void>
  quickCreateLabel?: string
}

function SearchableSelect({
  options, value, onChange, placeholder = 'Seleccionar…', disabled,
  onQuickCreate, quickCreateLabel = 'Crear nuevo',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const newNameRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)
  const filtered = query.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true); setQuery('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const handleSelect = (id: string) => {
    onChange(id); setOpen(false); setQuery('')
  }

  const handleCreate = async () => {
    if (!newName.trim() || !onQuickCreate) return
    setSaving(true)
    try { await onQuickCreate(newName.trim()); setNewName(''); setCreating(false) }
    finally { setSaving(false) }
  }

  return (
    <div ref={containerRef} className="flex gap-1.5">
      {/* Trigger + dropdown */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60',
            !selected && 'text-gray-400',
          )}
        >
          <span className="flex-1 truncate text-left font-medium">
            {selected ? selected.name : placeholder}
          </span>
          <ChevronDown className={cn('ml-1 h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-3 py-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Escape') { setOpen(false); setQuery('') }
                  if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); handleSelect(filtered[0].id) }
                }}
                placeholder="Buscar…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-400">Sin resultados</p>
              ) : filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                    value === opt.id && 'bg-blue-50 font-semibold text-blue-700',
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', value === opt.id ? 'opacity-100 text-blue-600' : 'opacity-0')} />
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick-create */}
      {onQuickCreate && (
        <div className="relative shrink-0">
          <button
            type="button"
            title={quickCreateLabel}
            onClick={() => { setCreating(!creating); setTimeout(() => newNameRef.current?.focus(), 30) }}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
              creating
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {creating && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
              <p className="mb-2 text-xs font-semibold text-gray-700">{quickCreateLabel}</p>
              <div className="flex gap-1.5">
                <input
                  ref={newNameRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="Nombre…"
                  className="h-8 flex-1 rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  disabled={!newName.trim() || saving}
                  onClick={handleCreate}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, children, className }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ── Size Cell ─────────────────────────────────────────────────────────────────

function SizeCell({ value, onChange, availableSizes, loadingSizes, categoryId, onCreateSize }: {
  value: string
  onChange: (v: string) => void
  availableSizes: { id: string; name: string }[]
  loadingSizes: boolean
  categoryId: string
  onCreateSize: (name: string) => Promise<void>
}) {
  const [newSizeName, setNewSizeName] = useState('')
  const [creatingSz, setCreatingSz] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  if (!categoryId) {
    return (
      <Input value={value} onChange={e => onChange(e.target.value)}
        placeholder="Talla" className="h-8 text-xs text-center" />
    )
  }

  if (loadingSizes) {
    return <div className="h-8 flex items-center px-2 text-xs text-gray-400">Cargando…</div>
  }

  const handleCreate = async () => {
    if (!newSizeName.trim()) return
    setCreatingSz(true)
    try {
      await onCreateSize(newSizeName.trim())
      onChange(newSizeName.trim())
      setNewSizeName(''); setShowAdd(false)
    } finally { setCreatingSz(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 flex-1 rounded-lg border border-gray-200 bg-white px-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">— talla —</option>
        {availableSizes.map(s => (
          <option key={s.id} value={s.name}>{s.name}</option>
        ))}
      </select>
      {/* Quick-add new size */}
      {showAdd ? (
        <div className="flex gap-0.5">
          <input
            autoFocus
            value={newSizeName}
            onChange={e => setNewSizeName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } if (e.key === 'Escape') setShowAdd(false) }}
            placeholder="ej: XXS"
            className="h-8 w-14 rounded-md border border-blue-300 px-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button type="button" onClick={handleCreate} disabled={creatingSz || !newSizeName.trim()}
            className="flex h-8 w-6 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {creatingSz ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button type="button" onClick={() => setShowAdd(false)}
            className="flex h-8 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)}
          title="Crear nueva talla"
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600">
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ProductCreateModal({ open, onOpenChange, onSuccess }: ProductCreateModalProps) {
  const router = useRouter()
  const { storeId, selectedStore } = useStore()

  // Derive default warehouse from store context
  const defaultWarehouse =
    selectedStore === 'HOMBRES' ? 'Tienda Hombres' : 'Tienda Mujeres'

  // Catalogs
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [lines, setLines] = useState<Option[]>([])
  const [allCategories, setAllCategories] = useState<Option[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)

  // Base data
  const [name, setName] = useState('')
  const [baseCodeOverride, setBaseCodeOverride] = useState<string | null>(null) // null = auto
  const computedBaseCode = computeBaseCode(name)
  const effectiveBaseCode = baseCodeOverride !== null ? baseCodeOverride : computedBaseCode
  const [supplierId, setSupplierId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [lineId, setLineId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse)

  // Image
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sizes
  const [availableSizes, setAvailableSizes] = useState<{ id: string; name: string }[]>([])
  const [loadingSizes, setLoadingSizes] = useState(false)

  // Variants
  const [variants, setVariants] = useState<VariantRow[]>([newRow()])

  // Saving + error
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Derived: categories filtered by line — STRICT: a category without line_id
  // would otherwise leak into every line, allowing line/category mismatches
  // (e.g. a "Casaca" de Mujeres asignada a un producto de Niños). Force the
  // user to pick a line before any category becomes selectable.
  const categories = lineId
    ? allCategories.filter((c) => c.line_id === lineId)
    : []

  // When line changes: reset category + auto-set warehouse from line name
  useEffect(() => {
    setCategoryId('')
    if (lineId) {
      const line = lines.find((l) => l.id === lineId)
      if (line) {
        const wh = warehouseFromLineName(line.name)
        if (wh) setWarehouseId(wh)
      }
    }
  }, [lineId, lines])

  // Load sizes when category changes
  useEffect(() => {
    if (!categoryId) { setAvailableSizes([]); return }
    setLoadingSizes(true)
    fetch(`/api/catalogs/sizes?category_id=${categoryId}`)
      .then(r => r.json())
      .then(data => setAvailableSizes(data?.data || []))
      .catch(() => setAvailableSizes([]))
      .finally(() => setLoadingSizes(false))
  }, [categoryId])

  // Load catalogs — filter lines by user's store
  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoadingCatalogs(true)
      try {
        const lineParams = storeId ? `?store_id=${storeId}` : ''
        const [lR, cR, bR, sR] = await Promise.all([
          fetch(`/api/catalogs/lines${lineParams}`),
          fetch('/api/catalogs/categories'),
          fetch('/api/catalogs/brands'),
          fetch('/api/catalogs/suppliers'),
        ])
        const [lD, cD, bD, sD] = await Promise.all([lR.json(), cR.json(), bR.json(), sR.json()])
        const arr = (d: unknown) => (Array.isArray(d) ? d : (d as any)?.data || [])
        const fetchedLines = arr(lD) as Option[]
        setLines(fetchedLines)
        setAllCategories(arr(cD))
        setBrands(arr(bD))
        setSuppliers(arr(sD))
      } catch {
        toast.error('Error', 'No se pudieron cargar los catálogos')
      } finally {
        setLoadingCatalogs(false)
      }
    }
    load()
  }, [open, storeId])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setName(''); setSupplierId(''); setBrandId('')
      setLineId(''); setCategoryId(''); setWarehouseId(defaultWarehouse)
      setImageUrl(''); setImagePreview(''); setVariants([newRow()]); setFormError('')
      setBaseCodeOverride(null)
    }
  }, [open])

  // Image upload
  const handleImageFile = async (file: File) => {
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('base_code', name.trim().slice(0, 4).toUpperCase() || `tmp-${Date.now()}`)
      fd.append('is_primary', 'true')
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success && json.data?.public_url) {
        setImageUrl(json.data.public_url); setImagePreview(json.data.public_url)
        toast.success('Imagen subida', 'Se subió correctamente')
      } else {
        toast.error('Error', json.error || 'No se pudo subir la imagen')
      }
    } catch { toast.error('Error', 'Error al subir la imagen') }
    finally { setUploadingImage(false) }
  }

  // Quick-create helpers
  const handleCreateSupplier = useCallback(async (supplierName: string) => {
    const fd = new FormData()
    fd.append('name', supplierName)
    const res = await createSupplier(fd)
    if (res.success && res.data) {
      const sup = { id: res.data.id, name: res.data.name }
      setSuppliers((p) => [...p, sup]); setSupplierId(sup.id)
      toast.success('Proveedor creado', supplierName)
    } else { toast.error('Error', 'No se pudo crear el proveedor') }
  }, [])

  const handleCreateBrand = useCallback(async (brandName: string) => {
    // createBrand requires at least one supplier_id
    if (!supplierId) {
      toast.error('Proveedor requerido', 'Selecciona un proveedor antes de crear una marca')
      return
    }

    // ── Dedup: si la marca ya existe en el listado, solo la asociamos ──────
    const trimmed = brandName.trim()
    const existing = brands.find(b => b.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      // Associate with current supplier (idempotent)
      await linkBrandToSupplier(existing.id, supplierId)
      setBrandId(existing.id)
      toast.success('Marca seleccionada', `"${existing.name}" ya existía — fue seleccionada`)
      return
    }

    const res = await createBrand({ name: trimmed, supplier_ids: [supplierId] })
    if (res.success && res.data) {
      const br = { id: res.data.id, name: res.data.name }
      setBrands((p) => [...p, br]); setBrandId(br.id)
      toast.success('Marca creada', trimmed)
    } else {
      const errMsg = typeof res.error === 'string' ? res.error : 'No se pudo crear la marca'
      toast.error('Error', errMsg)
    }
  }, [supplierId, brands])

  const handleCreateCategory = useCallback(async (categoryName: string) => {
    if (!lineId) { toast.error('Línea requerida', 'Selecciona una línea primero'); return }
    const res = await createCategory({ name: categoryName, line_id: lineId })
    if (res.success && res.data) {
      const cat = { id: res.data.id, name: res.data.name, line_id: lineId }
      setAllCategories((p) => [...p, cat]); setCategoryId(cat.id)
      toast.success('Categoría creada', categoryName)
    } else { toast.error('Error', 'No se pudo crear la categoría') }
  }, [lineId])

  const handleCreateSize = useCallback(async (sizeName: string) => {
    if (!categoryId) { toast.error('Categoría requerida', 'Selecciona una categoría primero'); return }
    const res = await createSize({ name: sizeName, category_id: categoryId })
    if (res.success && res.data) {
      const newSize = { id: res.data.id, name: res.data.name }
      setAvailableSizes(prev => [...prev, newSize].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Talla creada', sizeName)
    } else { toast.error('Error', 'No se pudo crear la talla') }
  }, [categoryId])

  const handleAddAllSizes = () => {
    if (availableSizes.length === 0) return
    const existingSizes = new Set(variants.map(v => v.size).filter(Boolean))
    const toAdd = availableSizes.filter(s => !existingSizes.has(s.name))
    if (toAdd.length === 0) { toast.info('Ya están todas', 'Todas las tallas ya tienen fila'); return }
    setVariants(prev => [...prev, ...toAdd.map(s => ({ ...newRow(), size: s.name }))])
  }

  // Variant helpers
  const updateVariant = (key: string, field: keyof VariantRow, value: string) =>
    setVariants((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r))

  const removeVariant = (key: string) =>
    setVariants((p) => p.length === 1 ? p : p.filter((r) => r._key !== key))

  // Validate
  const validate = () => {
    if (!name.trim()) return 'El nombre del producto es obligatorio'
    if (!supplierId) return 'Selecciona un proveedor'
    if (!brandId) return 'Selecciona una marca'
    if (!lineId) return 'Selecciona una línea'
    if (!categoryId) return 'Selecciona una categoría'
    const barcodes = variants.map(v => v.barcode.trim()).filter(Boolean)
    const barcodeDupes = barcodes.filter((b, i) => barcodes.indexOf(b) !== i)
    if (barcodeDupes.length > 0) return `Código de barras duplicado: "${barcodeDupes[0]}" — cada variante necesita un código único`
    for (const v of variants) {
      if (!v.barcode.trim()) return 'Todos los códigos de barra son obligatorios'
      const sp = parseFloat(v.sale_price)
      if (!v.sale_price || isNaN(sp) || sp <= 0) return 'El precio de venta debe ser mayor a 0'
      const qty = parseInt(v.quantity, 10)
      if (v.quantity === '' || isNaN(qty) || qty < 0) return 'La cantidad inicial no puede ser negativa'
    }
    return null
  }

  // Submit
  const handleSubmit = async () => {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError('')
    setSaving(true)
    try {
      const baseName = name.trim()
      const finalBaseCode = effectiveBaseCode || computeBaseCode(baseName) || 'PROD'
      const products = variants.map((v) => ({
        barcode: v.barcode.trim(),
        name: v.size ? `${baseName} - ${v.size}` : baseName,
        base_code: finalBaseCode,
        base_name: baseName,
        line_id: lineId,
        category_id: categoryId,
        brand_id: brandId,
        supplier_id: supplierId,
        size: v.size.trim() || undefined,
        color: v.color || undefined,
        purchase_price: parseFloat(v.purchase_price) || 0,
        price: parseFloat(v.sale_price),
        quantity: parseInt(v.quantity, 10) || 0,
        warehouse_id: warehouseId,
        image_url: imageUrl || null,
        min_stock: 1,
      }))

      const result = await createBulkProducts(products)
      if (!result.success) {
        toast.error('Error al guardar', String(result.error)); return
      }
      const { created = 0, updated = 0 } = (result.data as any) || {}
      toast.success(
        'Producto guardado',
        created > 0 ? `${created} variante(s) creada(s)${updated > 0 ? `, ${updated} actualizada(s)` : ''}`
          : `${updated} variante(s) actualizada(s)`,
      )
      onOpenChange(false); onSuccess?.(); router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col overflow-hidden p-0"
        style={{
          width: 'min(1160px, 96vw)',
          maxWidth: 'min(1160px, 96vw)',
          maxHeight: '92vh',
        }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pb-4 pt-5">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Nuevo Producto
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Completa los datos base y agrega las variantes (talla/color) que necesites.
          </p>
        </DialogHeader>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0 divide-y divide-gray-100">

            {/* ══ SECCIÓN 1: Datos base ══════════════════════════════ */}
            <div className="px-6 py-5 space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Datos base
              </p>

              {/* Row 1: Nombre + Código modelo */}
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="Nombre del producto" required>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setBaseCodeOverride(null) }}
                    placeholder="Ej: Chaleco Army, Blusa Floral…"
                    className="h-9"
                  />
                </Field>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Código modelo
                    {baseCodeOverride === null && name.trim() && (
                      <span className="text-[10px] text-emerald-600 font-normal">(auto)</span>
                    )}
                  </label>
                  <input
                    value={effectiveBaseCode}
                    onChange={e => setBaseCodeOverride(e.target.value.toUpperCase().slice(0, 8))}
                    placeholder="BLUAC"
                    maxLength={8}
                    className="h-9 w-28 rounded-lg border border-gray-300 bg-white px-3 text-sm font-mono font-semibold text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-[10px] text-gray-400">Agrupa variantes del mismo modelo</p>
                </div>
              </div>

              {/* Row 2: Proveedor · Marca */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Proveedor" required>
                  <SearchableSelect
                    options={suppliers}
                    value={supplierId}
                    onChange={setSupplierId}
                    placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar proveedor'}
                    disabled={loadingCatalogs}
                    onQuickCreate={handleCreateSupplier}
                    quickCreateLabel="Nuevo proveedor"
                  />
                </Field>
                <Field label="Marca" required>
                  <SearchableSelect
                    options={brands}
                    value={brandId}
                    onChange={setBrandId}
                    placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar marca'}
                    disabled={loadingCatalogs}
                    onQuickCreate={handleCreateBrand}
                    quickCreateLabel="Nueva marca"
                  />
                  {!supplierId && (
                    <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Selecciona proveedor antes de crear marca
                    </p>
                  )}
                </Field>
              </div>

              {/* Row 3: Línea · Categoría · Almacén */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Línea" required>
                  <SearchableSelect
                    options={lines}
                    value={lineId}
                    onChange={setLineId}
                    placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar línea'}
                    disabled={loadingCatalogs}
                  />
                </Field>
                <Field label="Categoría" required>
                  <SearchableSelect
                    options={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    placeholder={!lineId ? 'Elige línea primero' : loadingCatalogs ? 'Cargando…' : 'Seleccionar categoría'}
                    disabled={!lineId || loadingCatalogs}
                    onQuickCreate={lineId ? handleCreateCategory : undefined}
                    quickCreateLabel="Nueva categoría"
                  />
                </Field>
                <Field label="Almacén">
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {WAREHOUSES.map((w) => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Imagen del producto</p>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed',
                      imagePreview ? 'border-transparent' : 'border-gray-200 bg-gray-50',
                    )}
                  >
                    {imagePreview ? (
                      <div className="relative h-full w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="preview" className="h-[84px] w-[84px] rounded-xl object-cover" />
                        <button
                          type="button"
                          onClick={() => { setImageUrl(''); setImagePreview('') }}
                          className="absolute -right-2 -top-2 rounded-full bg-gray-900 p-0.5 text-white hover:bg-gray-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 h-9"
                    >
                      {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploadingImage ? 'Subiendo…' : 'Subir imagen'}
                    </Button>
                    <p className="text-xs text-gray-400">JPG, PNG o WEBP · máx. 2 MB</p>
                    <input
                      ref={fileInputRef} type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ══ SECCIÓN 2: Variantes ═══════════════════════════════ */}
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                    Variantes
                  </p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                    {variants.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {availableSizes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddAllSizes}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Todas las tallas ({availableSizes.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVariants((p) => [...p, newRow()])}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar variante
                  </button>
                </div>
              </div>
              {availableSizes.length > 0 && (
                <p className="text-xs text-gray-500">
                  Tallas disponibles para <strong>{categories.find(c => c.id === categoryId)?.name}</strong>:{' '}
                  {availableSizes.map(s => s.name).join(', ')}
                </p>
              )}

              {/* Table — scrollable horizontally on small screens */}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                {/* Header */}
                <div
                  className="grid bg-gray-50/80 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                  style={{ gridTemplateColumns: '2fr 160px 200px 130px 130px 120px 36px' }}
                >
                  <span>Código de barras</span>
                  <span>Talla</span>
                  <span>Color</span>
                  <span>P. Compra</span>
                  <span>P. Venta *</span>
                  <span>Stock ini.</span>
                  <span />
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-50">
                  {variants.map((row) => (
                    <div
                      key={row._key}
                      className="grid items-center gap-2 px-3 py-2"
                      style={{ gridTemplateColumns: '2fr 160px 200px 130px 130px 120px 36px' }}
                    >
                      {/* Barcode */}
                      <Input
                        value={row.barcode}
                        onChange={(e) => updateVariant(row._key, 'barcode', e.target.value)}
                        placeholder="0000000000000"
                        className="h-8 font-mono text-xs"
                      />
                      {/* Talla */}
                      <SizeCell
                        value={row.size}
                        onChange={(v) => updateVariant(row._key, 'size', v)}
                        availableSizes={availableSizes}
                        loadingSizes={loadingSizes}
                        categoryId={categoryId}
                        onCreateSize={handleCreateSize}
                      />
                      {/* Color */}
                      <CompactColorPicker
                        value={row.color}
                        onChange={(v) => updateVariant(row._key, 'color', v)}
                        placeholder="Color"
                      />
                      {/* P. Compra */}
                      <Input
                        type="number" min="0" step="0.01"
                        value={row.purchase_price}
                        onChange={(e) => updateVariant(row._key, 'purchase_price', e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                      {/* P. Venta */}
                      <Input
                        type="number" min="0" step="0.01"
                        value={row.sale_price}
                        onChange={(e) => updateVariant(row._key, 'sale_price', e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                      {/* Stock */}
                      <Input
                        type="number" min="0" step="1"
                        value={row.quantity}
                        onChange={(e) => updateVariant(row._key, 'quantity', e.target.value)}
                        placeholder="0"
                        className="h-8 text-xs text-center"
                      />
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeVariant(row._key)}
                        disabled={variants.length === 1}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                          variants.length === 1
                            ? 'cursor-not-allowed text-gray-200'
                            : 'text-gray-400 hover:bg-red-50 hover:text-red-500',
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Cada fila crea un SKU independiente. Deja Talla vacía si el producto no tiene variante de talla.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4">
          {formError && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="min-w-[150px] gap-2"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
              ) : (
                <><Check className="h-4 w-4" />Guardar producto</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
