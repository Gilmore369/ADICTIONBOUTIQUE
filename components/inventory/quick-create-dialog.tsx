'use client'

/**
 * QuickCreateDialog — Modales de creación rápida desde Ingreso Masivo
 *
 * Soporta: supplier | brand | line | category | size
 *
 * Mejorado por la auditoría 2026-05-01:
 *   - Cada modal muestra el CONTEXTO (proveedor/línea/categoría) como chip visible
 *   - Cuando hay contexto del padre, el campo dependiente se LOCKEA (no dropdown libre)
 *   - Talla incluye presets comunes (S/M/L/XL, números de calzado, ml de perfume)
 *   - Proveedor pide RUC y notas
 *   - Mensajes claros de validación
 *   - onSuccess devuelve el id+name para que el padre auto-seleccione
 */

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Lock, Sparkles, Search, Plus, Check } from 'lucide-react'
import { createSupplier, createBrand, createCategory, createSize, createLine, linkBrandToSupplier } from '@/actions/catalogs'
import { createBrowserClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuickCreateType = 'supplier' | 'brand' | 'line' | 'category' | 'size'

interface QuickCreateDialogProps {
  type: QuickCreateType
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Llamado con el id+name del registro creado para que el padre auto-seleccione */
  onSuccess: (id: string, name: string) => void
  // ─── Contexto desde el form padre ─────────────────────────────────────────
  /** Nombre legible del proveedor en contexto (para mostrar al usuario) */
  supplierName?: string
  /** ID del proveedor en contexto (para asociar marca) */
  supplierId?: string
  /** Nombre legible de la línea en contexto */
  lineName?: string
  /** ID de la línea en contexto (para crear categoría) */
  lineId?: string
  /** Nombre legible de la categoría en contexto */
  categoryName?: string
  /** ID de la categoría en contexto (para crear tallas) */
  categoryId?: string
}

// ─── Field configs ────────────────────────────────────────────────────────────

const META: Record<QuickCreateType, { title: string; description: string }> = {
  supplier: {
    title: 'Nuevo Proveedor',
    description: 'Datos básicos para registrar el proveedor',
  },
  brand: {
    title: 'Nueva Marca',
    description: 'La marca quedará asociada al proveedor del formulario',
  },
  line: {
    title: 'Nueva Línea',
    description: 'Línea de producto (Dama, Caballero, Niños, Belleza...)',
  },
  category: {
    title: 'Nueva Categoría',
    description: 'Categoría dentro de una línea',
  },
  size: {
    title: 'Nuevas Tallas',
    description: 'Crea una o varias tallas para la categoría',
  },
}

// ─── Presets de tallas según tipo de categoría ───────────────────────────────

const SIZE_PRESETS = [
  { label: 'Ropa adulto', sizes: 'XS, S, M, L, XL, XXL' },
  { label: 'Ropa niño', sizes: '4, 6, 8, 10, 12, 14' },
  { label: 'Calzado mujer', sizes: '35, 36, 37, 38, 39, 40' },
  { label: 'Calzado hombre', sizes: '38, 39, 40, 41, 42, 43, 44' },
  { label: 'Perfume', sizes: '30ml, 50ml, 100ml' },
  { label: 'Talla única', sizes: 'Único' },
]

// ─── Empty form states ────────────────────────────────────────────────────────

const emptySupplier = () => ({
  name: '', ruc: '', contact_name: '', phone: '', email: '', address: '', notes: '',
})
const emptyBrand    = () => ({ name: '', description: '' })
const emptyLine     = () => ({ name: '', description: '' })
const emptyCategory = () => ({ name: '', description: '', line_id: '' })
const emptySize     = () => ({ names: '', category_id: '' })

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickCreateDialog({
  type, open, onOpenChange, onSuccess,
  supplierName, supplierId,
  lineName, lineId,
  categoryName, categoryId,
}: QuickCreateDialogProps) {

  const [saving, setSaving] = useState(false)

  // Per-type form state
  const [supplier, setSupplier] = useState(emptySupplier)
  const [brand,    setBrand]    = useState(emptyBrand)
  const [line,     setLine]     = useState(emptyLine)
  const [category, setCategory] = useState(() => ({ ...emptyCategory(), line_id: lineId || '' }))
  const [sizeForm, setSizeForm] = useState(() => ({ ...emptySize(), category_id: categoryId || '' }))

  // Catalogos solo se cargan si NO hay contexto del padre (fallback)
  const [lines,      setLines]      = useState<Array<{ id: string; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)

  // Para el modal de Marca: tabs y búsqueda de marcas existentes
  const [brandMode, setBrandMode] = useState<'existing' | 'new'>('existing')
  const [allBrands, setAllBrands] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [linkedBrandIds, setLinkedBrandIds] = useState<Set<string>>(new Set())
  const [brandSearch, setBrandSearch] = useState('')
  const [loadingBrands, setLoadingBrands] = useState(false)

  // Reset cuando abre
  useEffect(() => {
    if (!open) return
    setSupplier(emptySupplier())
    setBrand(emptyBrand())
    setLine(emptyLine())
    setCategory({ ...emptyCategory(), line_id: lineId || '' })
    setSizeForm({ ...emptySize(), category_id: categoryId || '' })

    // Solo cargar catálogos si NO hay contexto
    if (type === 'category' && !lineId) loadLines()
    if (type === 'size'     && !categoryId) loadCategories()

    // Para marcas: cargar todas las globales + las ya asociadas al proveedor
    if (type === 'brand' && supplierId) {
      setBrandMode('existing')
      setBrandSearch('')
      loadAllBrands(supplierId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, lineId, categoryId, supplierId])

  const loadAllBrands = async (currentSupplierId: string) => {
    setLoadingBrands(true)
    const supabase = createBrowserClient()
    const [allRes, linkedRes] = await Promise.all([
      supabase.from('brands').select('id, name, description').eq('active', true).order('name'),
      supabase.from('supplier_brands').select('brand_id').eq('supplier_id', currentSupplierId),
    ])
    setAllBrands(allRes.data || [])
    setLinkedBrandIds(new Set((linkedRes.data || []).map(r => r.brand_id)))
    setLoadingBrands(false)
  }

  const loadLines = async () => {
    setLoadingCatalogs(true)
    const supabase = createBrowserClient()
    const { data } = await supabase.from('lines').select('id, name').eq('active', true).order('name')
    setLines(data || [])
    setLoadingCatalogs(false)
  }

  const loadCategories = async () => {
    setLoadingCatalogs(true)
    const supabase = createBrowserClient()
    const { data } = await supabase.from('categories').select('id, name').eq('active', true).order('name')
    setCategories(data || [])
    setLoadingCatalogs(false)
  }

  // ─── Save handlers ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      switch (type) {
        case 'supplier': await saveSupplier(); break
        case 'brand':    await saveBrand();    break
        case 'line':     await saveLine();     break
        case 'category': await saveCategory(); break
        case 'size':     await saveSizes();    break
      }
    } finally {
      setSaving(false)
    }
  }

  const saveSupplier = async () => {
    if (!supplier.name.trim()) { toast.error('El nombre es obligatorio'); return }
    const fd = new FormData()
    fd.append('name',         supplier.name.trim())
    fd.append('ruc',          supplier.ruc.trim())
    fd.append('contact_name', supplier.contact_name.trim())
    fd.append('phone',        supplier.phone.trim())
    fd.append('email',        supplier.email.trim())
    fd.append('address',      supplier.address.trim())
    fd.append('notes',        supplier.notes.trim())
    const res = await createSupplier(fd)
    if (res?.success && res.data) {
      toast.success(`Proveedor "${res.data.name}" creado`)
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear proveedor')
    }
  }

  const saveBrand = async () => {
    if (!supplierId) { toast.error('Selecciona un proveedor en el formulario principal antes de crear una marca'); return }

    if (brandMode === 'new') {
      // Crear marca nueva (validar duplicado antes para mensaje claro)
      const trimmed = brand.name.trim()
      if (!trimmed) { toast.error('El nombre es obligatorio'); return }

      const dup = allBrands.find(b => b.name.toLowerCase() === trimmed.toLowerCase())
      if (dup) {
        toast.error(`La marca "${dup.name}" ya existe. Usa la pestaña "Asociar existente" para vincularla a este proveedor.`)
        // Cambiar a tab existente y prellenar búsqueda con el nombre
        setBrandMode('existing')
        setBrandSearch(trimmed)
        return
      }

      const fd = new FormData()
      fd.append('name',           trimmed)
      fd.append('description',    brand.description.trim())
      fd.append('supplier_ids[]', supplierId)
      const res = await createBrand(fd)
      if (res?.success && res.data) {
        toast.success(`Marca "${res.data.name}" creada y asociada a ${supplierName || 'el proveedor'}`)
        onSuccess(res.data.id, res.data.name)
        onOpenChange(false)
      } else {
        toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear marca')
      }
    }
    // brandMode === 'existing' usa handlePickExistingBrand directamente desde el click
  }

  const handlePickExistingBrand = async (b: { id: string; name: string }) => {
    if (!supplierId) return
    const res = await linkBrandToSupplier(b.id, supplierId)
    if (res?.success && res.data) {
      const wasLinked = res.data.alreadyLinked
      toast.success(
        wasLinked
          ? `"${b.name}" ya estaba asociada — seleccionada`
          : `"${b.name}" asociada a ${supplierName || 'el proveedor'}`
      )
      onSuccess(b.id, b.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al asociar la marca')
    }
  }

  const saveLine = async () => {
    if (!line.name.trim()) { toast.error('El nombre es obligatorio'); return }
    const fd = new FormData()
    fd.append('name',        line.name.trim())
    fd.append('description', line.description.trim())
    const res = await createLine(fd)
    if (res?.success && res.data) {
      toast.success(`Línea "${res.data.name}" creada`)
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear línea')
    }
  }

  const saveCategory = async () => {
    const finalLineId = lineId || category.line_id
    if (!category.name.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!finalLineId)          { toast.error('Selecciona una línea'); return }
    const fd = new FormData()
    fd.append('name',        category.name.trim())
    fd.append('line_id',     finalLineId)
    fd.append('description', category.description.trim())
    const res = await createCategory(fd)
    if (res?.success && res.data) {
      toast.success(`Categoría "${res.data.name}" creada en línea ${lineName || ''}`)
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear categoría')
    }
  }

  const saveSizes = async () => {
    const finalCategoryId = categoryId || sizeForm.category_id
    if (!sizeForm.names.trim()) { toast.error('Ingresa al menos una talla'); return }
    if (!finalCategoryId)       { toast.error('Selecciona una categoría'); return }

    const sizeNames = sizeForm.names.split(',').map(n => n.trim()).filter(Boolean)
    if (!sizeNames.length) { toast.error('Tallas inválidas'); return }

    let ok = 0
    let fail = 0
    let lastId = ''
    let lastName = ''
    const created: Array<{ id: string; name: string }> = []

    for (const sizeName of sizeNames) {
      const fd = new FormData()
      fd.append('name',        sizeName)
      fd.append('category_id', finalCategoryId)
      const res = await createSize(fd)
      if (res?.success && res.data) {
        ok++
        lastId = res.data.id
        lastName = res.data.name
        created.push({ id: res.data.id, name: res.data.name })
      } else {
        fail++
      }
    }

    if (ok > 0) {
      const msg = fail > 0
        ? `${ok} talla(s) creadas · ${fail} fallaron (probablemente duplicadas)`
        : `${ok} talla(s) creadas`
      toast.success(msg)

      // Llamar onSuccess con la última creada (el padre puede recargar la lista completa)
      // La función onSuccess en el padre (handleSizeCreated) recarga todas las tallas de la categoría
      onSuccess(lastId, lastName)
      onOpenChange(false)
    } else {
      toast.error('No se pudo crear ninguna talla. Verifica que no estén duplicadas.')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const meta = META[type]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription className="text-xs">{meta.description}</DialogDescription>
        </DialogHeader>

        {/* ── CHIPS DE CONTEXTO ────────────────────────────────────────── */}
        {type === 'brand' && supplierName && (
          <ContextChip icon={<Lock className="h-3 w-3" />} label="Para proveedor" value={supplierName} />
        )}
        {type === 'category' && lineName && (
          <ContextChip icon={<Lock className="h-3 w-3" />} label="Para línea" value={lineName} />
        )}
        {type === 'size' && categoryName && (
          <ContextChip icon={<Lock className="h-3 w-3" />} label="Para categoría" value={categoryName} />
        )}

        <div className="space-y-3 py-1">

          {/* ── PROVEEDOR ─────────────────────────────────────────────── */}
          {type === 'supplier' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre comercial *" className="col-span-2">
                  <Input
                    autoFocus
                    placeholder="Ej: Distribuidora ABC SAC"
                    value={supplier.name}
                    onChange={e => setSupplier(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                  />
                </Field>
                <Field label="RUC">
                  <Input
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="20123456789"
                    value={supplier.ruc}
                    onChange={e => setSupplier(p => ({ ...p, ruc: e.target.value.replace(/\D/g, '') }))}
                  />
                </Field>
                <Field label="Teléfono">
                  <Input
                    type="tel"
                    placeholder="999 888 777"
                    value={supplier.phone}
                    onChange={e => setSupplier(p => ({ ...p, phone: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Persona de contacto">
                <Input
                  placeholder="Nombre del vendedor o asesor"
                  value={supplier.contact_name}
                  onChange={e => setSupplier(p => ({ ...p, contact_name: e.target.value }))}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  placeholder="contacto@proveedor.com"
                  value={supplier.email}
                  onChange={e => setSupplier(p => ({ ...p, email: e.target.value }))}
                />
              </Field>
              <Field label="Dirección">
                <Input
                  placeholder="Av. Principal 123, Lima"
                  value={supplier.address}
                  onChange={e => setSupplier(p => ({ ...p, address: e.target.value }))}
                />
              </Field>
              <Field label="Notas internas">
                <Textarea
                  rows={2}
                  placeholder="Cualquier información útil: condiciones de pago, días de entrega, etc."
                  value={supplier.notes}
                  onChange={e => setSupplier(p => ({ ...p, notes: e.target.value }))}
                />
              </Field>
            </>
          )}

          {/* ── MARCA (con tabs: Asociar existente | Crear nueva) ───────── */}
          {type === 'brand' && (
            <>
              {!supplierId && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Necesitas seleccionar un proveedor en el formulario principal antes de crear la marca.
                </p>
              )}

              {/* Tabs: existente / nueva */}
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm w-full">
                <button
                  type="button"
                  onClick={() => setBrandMode('existing')}
                  disabled={!supplierId}
                  className={`flex-1 px-3 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    brandMode === 'existing' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                  Asociar existente
                </button>
                <button
                  type="button"
                  onClick={() => setBrandMode('new')}
                  disabled={!supplierId}
                  className={`flex-1 px-3 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    brandMode === 'new' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear nueva
                </button>
              </div>

              {brandMode === 'existing' ? (
                <>
                  <p className="text-xs text-gray-500">
                    Las marcas que <strong>no</strong> están asociadas a este proveedor aparecen con &quot;+ Asociar&quot;.
                    Las que sí, con un check verde.
                  </p>
                  <Field label="Buscar marca">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        autoFocus
                        placeholder="Escribe para filtrar (Nike, Adidas...)"
                        value={brandSearch}
                        onChange={e => setBrandSearch(e.target.value)}
                        className="pl-8"
                        disabled={!supplierId}
                      />
                    </div>
                  </Field>
                  <div className="max-h-[260px] overflow-y-auto border rounded-md divide-y">
                    {loadingBrands ? (
                      <p className="text-center text-sm text-gray-400 py-6">Cargando…</p>
                    ) : (() => {
                      const filtered = allBrands.filter(b =>
                        !brandSearch || b.name.toLowerCase().includes(brandSearch.toLowerCase())
                      )
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-6 px-4 space-y-2">
                            <p className="text-sm text-gray-500">
                              {brandSearch
                                ? `No se encontró ninguna marca con "${brandSearch}"`
                                : 'No hay marcas creadas'}
                            </p>
                            {brandSearch && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBrandMode('new')
                                  setBrand({ name: brandSearch, description: '' })
                                }}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Crear &quot;{brandSearch}&quot; como marca nueva →
                              </button>
                            )}
                          </div>
                        )
                      }
                      return filtered.map(b => {
                        const isLinked = linkedBrandIds.has(b.id)
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handlePickExistingBrand(b)}
                            disabled={saving}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left transition-colors disabled:opacity-50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                              {b.description && (
                                <p className="text-[11px] text-gray-500 truncate">{b.description}</p>
                              )}
                            </div>
                            {isLinked ? (
                              <span className="flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3" /> Asociada
                              </span>
                            ) : (
                              <span className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                                + Asociar
                              </span>
                            )}
                          </button>
                        )
                      })
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <Field label="Nombre de la marca *">
                    <Input
                      autoFocus
                      placeholder="Ej: Nike, Adidas, Tommy…"
                      value={brand.name}
                      onChange={e => setBrand(p => ({ ...p, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      disabled={!supplierId}
                    />
                  </Field>
                  <Field label="Descripción (opcional)">
                    <Textarea
                      rows={2}
                      placeholder="Información sobre la marca"
                      value={brand.description}
                      onChange={e => setBrand(p => ({ ...p, description: e.target.value }))}
                      disabled={!supplierId}
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {/* ── LÍNEA ─────────────────────────────────────────────────── */}
          {type === 'line' && (
            <>
              <Field label="Nombre de la línea *">
                <Input
                  autoFocus
                  placeholder="Ej: Dama, Caballero, Niños, Belleza"
                  value={line.name}
                  onChange={e => setLine(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>
              <Field label="Descripción (opcional)">
                <Textarea
                  rows={2}
                  placeholder="Para qué tipo de productos es esta línea"
                  value={line.description}
                  onChange={e => setLine(p => ({ ...p, description: e.target.value }))}
                />
              </Field>
            </>
          )}

          {/* ── CATEGORÍA ─────────────────────────────────────────────── */}
          {type === 'category' && (
            <>
              {/* Si hay lineId del padre, no mostrar dropdown — está lockeado por el chip */}
              {!lineId && (
                <Field label="Línea *">
                  <Select
                    value={category.line_id}
                    onValueChange={v => setCategory(p => ({ ...p, line_id: v }))}
                    disabled={loadingCatalogs}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar línea'} />
                    </SelectTrigger>
                    <SelectContent>
                      {lines.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Nombre de la categoría *">
                <Input
                  autoFocus
                  placeholder="Ej: Camisetas, Pantalones, Calzado, Perfumes"
                  value={category.name}
                  onChange={e => setCategory(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>
              <Field label="Descripción (opcional)">
                <Textarea
                  rows={2}
                  placeholder="Tipo de productos que entran en esta categoría"
                  value={category.description}
                  onChange={e => setCategory(p => ({ ...p, description: e.target.value }))}
                />
              </Field>
            </>
          )}

          {/* ── TALLA ─────────────────────────────────────────────────── */}
          {type === 'size' && (
            <>
              {/* Si hay categoryId del padre, no mostrar dropdown — está lockeado */}
              {!categoryId && (
                <Field label="Categoría *">
                  <Select
                    value={sizeForm.category_id}
                    onValueChange={v => setSizeForm(p => ({ ...p, category_id: v }))}
                    disabled={loadingCatalogs}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar categoría'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="Talla(s) *" hint="Separa varias con coma. Ej: S, M, L, XL">
                <Input
                  autoFocus
                  placeholder="S, M, L, XL, XXL"
                  value={sizeForm.names}
                  onChange={e => setSizeForm(p => ({ ...p, names: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>

              {/* Presets rápidos */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Presets rápidos
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setSizeForm(p => ({ ...p, names: preset.sizes }))}
                      className="text-[11px] px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Click en un preset para llenar el campo. Puedes editarlo después.
                </p>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            {type === 'brand' && brandMode === 'existing' ? 'Cerrar' : 'Cancelar'}
          </Button>
          {/* En modo "asociar existente" no hay botón Crear: el click en la lista ya asocia */}
          {!(type === 'brand' && brandMode === 'existing') && (
            <Button size="sm" onClick={handleSave} disabled={saving || (type === 'brand' && !supplierId)}>
              {saving ? 'Guardando…' : 'Crear y usar'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ContextChip({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200">
      <span className="text-blue-600">{icon}</span>
      <span className="text-xs text-blue-700">
        {label}: <strong className="font-semibold">{value}</strong>
      </span>
    </div>
  )
}

function Field({
  label, hint, children, className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1 ${className || ''}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
