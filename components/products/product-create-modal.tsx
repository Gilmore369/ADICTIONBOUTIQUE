'use client'

/**
 * ProductCreateModal — Unified product creation dialog
 *
 * Handles "producto simple" and "múltiples variantes" in one component.
 * - Section 1: Base data — searchable selects (inline dropdown) + quick-create (+)
 *   for Proveedor, Marca and Categoría.
 * - Section 2: Variants table (barcode · talla · color · p.compra · p.venta · stock)
 * - Image upload with preview below data section.
 * - Calls createBulkProducts under the hood.
 *
 * Dependencies: only uses existing UI components (dialog, button, input, label)
 * plus CompactColorPicker. No cmdk / radix-popover required.
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
import { createSupplier, createBrand, createCategory } from '@/actions/catalogs'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  ImageIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

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

// ── Constants ─────────────────────────────────────────────────────────────────

const WAREHOUSES = [
  { id: 'Tienda Mujeres', label: 'Tienda Mujeres' },
  { id: 'Tienda Hombres', label: 'Tienda Hombres' },
]

let _rowCounter = 0
function newRow(): VariantRow {
  return {
    _key: `row-${++_rowCounter}`,
    barcode: '',
    size: '',
    color: '',
    purchase_price: '',
    sale_price: '',
    quantity: '',
  }
}

// ── Searchable Select ─────────────────────────────────────────────────────────
// Custom inline dropdown — no external dependencies needed

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
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  disabled,
  onQuickCreate,
  quickCreateLabel = 'Crear nuevo',
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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const handleSelect = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  const handleQuickCreate = async () => {
    if (!newName.trim() || !onQuickCreate) return
    setSaving(true)
    try {
      await onQuickCreate(newName.trim())
      setNewName('')
      setCreating(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={containerRef} className="flex gap-1">
      {/* Trigger */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background',
            'px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="flex-1 truncate text-left">
            {selected ? selected.name : placeholder}
          </span>
          <ChevronDown
            className={cn(
              'ml-1 h-3.5 w-3.5 shrink-0 opacity-50 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
            {/* Search */}
            <div className="border-b border-gray-100 px-2 py-1.5">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Escape') { setOpen(false); setQuery('') }
                  if (e.key === 'Enter' && filtered.length === 1) {
                    e.preventDefault()
                    handleSelect(filtered[0].id)
                  }
                }}
                placeholder="Buscar…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>

            {/* Options */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-50',
                      value === opt.id && 'font-medium text-blue-600',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        value === opt.id ? 'opacity-100 text-blue-600' : 'opacity-0',
                      )}
                    />
                    {opt.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick-create button */}
      {onQuickCreate && (
        <div className="relative">
          <button
            type="button"
            title={quickCreateLabel}
            onClick={() => {
              setCreating(!creating)
              setTimeout(() => newNameRef.current?.focus(), 30)
            }}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
              creating
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Quick-create popover */}
          {creating && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs font-semibold text-gray-700">
                {quickCreateLabel}
              </p>
              <div className="flex gap-1.5">
                <input
                  ref={newNameRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleQuickCreate() }
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="Nombre…"
                  className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newName.trim() || saving}
                  onClick={handleQuickCreate}
                  className="h-8 px-2"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ProductCreateModal({
  open,
  onOpenChange,
  onSuccess,
}: ProductCreateModalProps) {
  const router = useRouter()

  // Catalog data
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [lines, setLines] = useState<Option[]>([])
  const [allCategories, setAllCategories] = useState<Option[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)

  // Base data
  const [name, setName] = useState('')
  const [baseCode, setBaseCode] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [lineId, setLineId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [warehouseId, setWarehouseId] = useState('Tienda Mujeres')

  // Image
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Variants
  const [variants, setVariants] = useState<VariantRow[]>([newRow()])

  // Saving
  const [saving, setSaving] = useState(false)

  // Derived
  const categories = lineId
    ? allCategories.filter((c) => !c.line_id || c.line_id === lineId)
    : allCategories

  useEffect(() => {
    setCategoryId('')
  }, [lineId])

  // Load catalogs on open
  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoadingCatalogs(true)
      try {
        const [lRes, cRes, bRes, sRes] = await Promise.all([
          fetch('/api/catalogs/lines'),
          fetch('/api/catalogs/categories'),
          fetch('/api/catalogs/brands'),
          fetch('/api/catalogs/suppliers'),
        ])
        const [lD, cD, bD, sD] = await Promise.all([
          lRes.json(), cRes.json(), bRes.json(), sRes.json(),
        ])
        const arr = (d: unknown) =>
          Array.isArray(d) ? d : (d as any)?.data || []
        setLines(arr(lD))
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
  }, [open])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setName('')
      setBaseCode('')
      setSupplierId('')
      setBrandId('')
      setLineId('')
      setCategoryId('')
      setWarehouseId('Tienda Mujeres')
      setImageUrl('')
      setImagePreview('')
      setVariants([newRow()])
    }
  }, [open])

  // Image upload
  const handleImageFile = async (file: File) => {
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('base_code', baseCode || `temp-${Date.now()}`)
      fd.append('is_primary', 'true')
      const res = await fetch('/api/upload/product-image', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (json.success && json.data?.public_url) {
        setImageUrl(json.data.public_url)
        setImagePreview(json.data.public_url)
        toast.success('Imagen subida', 'La imagen se subió correctamente')
      } else {
        toast.error('Error', json.error || 'No se pudo subir la imagen')
      }
    } catch {
      toast.error('Error', 'Error al subir la imagen')
    } finally {
      setUploadingImage(false)
    }
  }

  // Quick-create helpers
  const handleCreateSupplier = useCallback(async (supplierName: string) => {
    const fd = new FormData()
    fd.append('name', supplierName)
    const res = await createSupplier(fd)
    if (res.success && res.data) {
      const sup = { id: res.data.id, name: res.data.name }
      setSuppliers((prev) => [...prev, sup])
      setSupplierId(sup.id)
      toast.success('Proveedor creado', supplierName)
    } else {
      toast.error('Error', 'No se pudo crear el proveedor')
    }
  }, [])

  const handleCreateBrand = useCallback(async (brandName: string) => {
    const res = await createBrand({ name: brandName })
    if (res.success && res.data) {
      const br = { id: res.data.id, name: res.data.name }
      setBrands((prev) => [...prev, br])
      setBrandId(br.id)
      toast.success('Marca creada', brandName)
    } else {
      toast.error('Error', 'No se pudo crear la marca')
    }
  }, [])

  const handleCreateCategory = useCallback(
    async (categoryName: string) => {
      if (!lineId) {
        toast.error('Línea requerida', 'Selecciona una línea primero')
        return
      }
      const res = await createCategory({ name: categoryName, line_id: lineId })
      if (res.success && res.data) {
        const cat = { id: res.data.id, name: res.data.name, line_id: lineId }
        setAllCategories((prev) => [...prev, cat])
        setCategoryId(cat.id)
        toast.success('Categoría creada', categoryName)
      } else {
        toast.error('Error', 'No se pudo crear la categoría')
      }
    },
    [lineId],
  )

  // Variant helpers
  const updateVariant = (key: string, field: keyof VariantRow, value: string) => {
    setVariants((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)),
    )
  }

  const removeVariant = (key: string) => {
    setVariants((prev) => (prev.length === 1 ? prev : prev.filter((r) => r._key !== key)))
  }

  // Validation
  const validate = () => {
    if (!name.trim()) return 'El nombre es obligatorio'
    if (!supplierId) return 'Selecciona un proveedor'
    if (!brandId) return 'Selecciona una marca'
    if (!lineId) return 'Selecciona una línea'
    if (!categoryId) return 'Selecciona una categoría'
    for (const v of variants) {
      if (!v.barcode.trim()) return 'Todos los códigos de barra son obligatorios'
      if (!v.sale_price || isNaN(parseFloat(v.sale_price)) || parseFloat(v.sale_price) <= 0)
        return 'El precio de venta debe ser mayor a 0'
      if (
        v.quantity === '' ||
        isNaN(parseInt(v.quantity, 10)) ||
        parseInt(v.quantity, 10) < 0
      )
        return 'La cantidad inicial no puede ser negativa'
    }
    return null
  }

  // Submit
  const handleSubmit = async () => {
    const err = validate()
    if (err) { toast.error('Datos incompletos', err); return }

    setSaving(true)
    try {
      const baseName = name.trim()
      const products = variants.map((v) => ({
        barcode: v.barcode.trim(),
        name: v.size ? `${baseName} - ${v.size}` : baseName,
        base_code: baseCode.trim() || undefined,
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
        toast.error('Error al guardar', String(result.error))
        return
      }

      const { created = 0, updated = 0 } = (result.data as any) || {}
      toast.success(
        'Producto guardado',
        created > 0 && updated > 0
          ? `${created} creado(s), ${updated} actualizado(s)`
          : created > 0
            ? `${created} variante(s) creada(s)`
            : `${updated} variante(s) actualizada(s)`,
      )
      onOpenChange(false)
      onSuccess?.()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="border-b border-gray-100 px-6 pb-4 pt-6">
          <DialogTitle className="text-lg font-semibold">Nuevo Producto</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Completa los datos base y agrega las variantes que necesites.
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">

          {/* ═══ SECCIÓN 1: Datos base ═══════════════════════════════ */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Datos base
            </h3>

            {/* Nombre + Código base */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="prod-name" className="text-sm font-medium">
                  Nombre del producto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="prod-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Chaleco Army, Blusa Floral…"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-basecode" className="text-sm font-medium">
                  Código base{' '}
                  <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </Label>
                <Input
                  id="prod-basecode"
                  value={baseCode}
                  onChange={(e) => setBaseCode(e.target.value.toUpperCase())}
                  placeholder="Ej: CHA-01"
                  className="h-9 font-mono"
                />
              </div>
            </div>

            {/* Catalog selects — 2 col grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Proveedor <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={suppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar proveedor'}
                  disabled={loadingCatalogs}
                  onQuickCreate={handleCreateSupplier}
                  quickCreateLabel="Nuevo proveedor"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Marca <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={brands}
                  value={brandId}
                  onChange={setBrandId}
                  placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar marca'}
                  disabled={loadingCatalogs}
                  onQuickCreate={handleCreateBrand}
                  quickCreateLabel="Nueva marca"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Línea <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={lines}
                  value={lineId}
                  onChange={setLineId}
                  placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar línea'}
                  disabled={loadingCatalogs}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Categoría <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder={
                    !lineId
                      ? 'Selecciona una línea primero'
                      : loadingCatalogs
                        ? 'Cargando…'
                        : 'Seleccionar categoría'
                  }
                  disabled={!lineId || loadingCatalogs}
                  onQuickCreate={lineId ? handleCreateCategory : undefined}
                  quickCreateLabel="Nueva categoría"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Almacén</Label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {WAREHOUSES.map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Imagen del producto</Label>
              <div className="flex items-start gap-4">
                {/* Preview box */}
                <div
                  className={cn(
                    'flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed',
                    imagePreview ? 'border-transparent' : 'border-gray-200 bg-gray-50',
                  )}
                >
                  {imagePreview ? (
                    <div className="relative h-full w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="h-24 w-24 rounded-xl object-cover"
                      />
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

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {uploadingImage ? 'Subiendo…' : 'Subir imagen'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG o WEBP · máx. 2 MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* ═══ SECCIÓN 2: Variantes ════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Variantes
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-normal text-gray-500">
                  {variants.length} {variants.length === 1 ? 'fila' : 'filas'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setVariants((prev) => [...prev, newRow()])}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar variante
              </button>
            </div>

            {/* Variants table */}
            <div className="overflow-hidden rounded-xl border border-gray-100">
              {/* Column headers */}
              <div
                className="grid bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                style={{ gridTemplateColumns: '1fr 90px 150px 110px 110px 90px 36px' }}
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
                    className="grid items-center gap-1.5 px-3 py-2"
                    style={{ gridTemplateColumns: '1fr 90px 150px 110px 110px 90px 36px' }}
                  >
                    <Input
                      value={row.barcode}
                      onChange={(e) => updateVariant(row._key, 'barcode', e.target.value)}
                      placeholder="0000000000000"
                      className="h-8 font-mono text-xs"
                    />
                    <Input
                      value={row.size}
                      onChange={(e) => updateVariant(row._key, 'size', e.target.value)}
                      placeholder="S, M, L…"
                      className="h-8 text-xs"
                    />
                    <CompactColorPicker
                      value={row.color}
                      onChange={(v) => updateVariant(row._key, 'color', v)}
                      placeholder="Color"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.purchase_price}
                      onChange={(e) =>
                        updateVariant(row._key, 'purchase_price', e.target.value)
                      }
                      placeholder="0.00"
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.sale_price}
                      onChange={(e) =>
                        updateVariant(row._key, 'sale_price', e.target.value)
                      }
                      placeholder="0.00"
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.quantity}
                      onChange={(e) =>
                        updateVariant(row._key, 'quantity', e.target.value)
                      }
                      placeholder="0"
                      className="h-8 text-xs"
                    />
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
              Cada fila crea un SKU independiente. Deja Talla vacía para un producto sin variante de talla.
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-gray-100 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="min-w-[140px] gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Guardar producto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
