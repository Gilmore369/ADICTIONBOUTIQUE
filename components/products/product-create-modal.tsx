'use client'

/**
 * ProductCreateModal — Unified product creation dialog
 *
 * Handles both "producto simple" and "múltiples variantes" in a single component.
 * - Section 1: Base data with searchable Combobox selects + quick-create (+) for
 *   Proveedor, Marca and Categoría.
 * - Section 2: Editable variants table (barcode · talla · color · p.compra · p.venta · stock)
 * - Image upload (preview) below Section 1
 * - Calls createBulkProducts under the hood
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
  line_id?: string // for categories
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

// ── Searchable Combobox ───────────────────────────────────────────────────────

interface ComboboxProps {
  options: Option[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  /** Small inline form shown in a second popover via the + button */
  onQuickCreate?: (name: string) => Promise<void>
  quickCreateLabel?: string
}

function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  emptyText = 'Sin resultados',
  disabled,
  onQuickCreate,
  quickCreateLabel = 'Crear nuevo',
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)

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
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background',
              'px-3 py-2 text-sm ring-offset-background',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !selected && 'text-muted-foreground',
            )}
          >
            <span className="flex-1 truncate text-left">
              {selected ? selected.name : placeholder}
            </span>
            <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar…" />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.name}
                    onSelect={() => {
                      onChange(opt.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === opt.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {opt.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {onQuickCreate && (
        <Popover
          open={creating}
          onOpenChange={(o) => {
            setCreating(o)
            if (o) setTimeout(() => inputRef.current?.focus(), 50)
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              title={quickCreateLabel}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed',
                'border-gray-300 text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <p className="mb-2 text-xs font-semibold text-gray-700">
              {quickCreateLabel}
            </p>
            <div className="flex gap-1.5">
              <Input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleQuickCreate() }
                }}
                placeholder="Nombre…"
                className="h-8 text-sm"
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
          </PopoverContent>
        </Popover>
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

  // ── Catalog data ─────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [lines, setLines] = useState<Option[]>([])
  const [allCategories, setAllCategories] = useState<Option[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)

  // ── Base data ─────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [baseCode, setBaseCode] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [lineId, setLineId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [warehouseId, setWarehouseId] = useState('Tienda Mujeres')

  // ── Image ─────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Variants ──────────────────────────────────────────────────────
  const [variants, setVariants] = useState<VariantRow[]>([newRow()])

  // ── Saving ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  // Filtered categories by selected line
  const categories =
    lineId
      ? allCategories.filter((c) => !c.line_id || c.line_id === lineId)
      : allCategories

  // Reset category when line changes
  useEffect(() => {
    setCategoryId('')
  }, [lineId])

  // Load catalogs when modal opens
  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoadingCatalogs(true)
      try {
        const [linesRes, catsRes, brandsRes, suppRes] = await Promise.all([
          fetch('/api/catalogs/lines'),
          fetch('/api/catalogs/categories'),
          fetch('/api/catalogs/brands'),
          fetch('/api/catalogs/suppliers'),
        ])
        const [linesData, catsData, brandsData, suppData] = await Promise.all([
          linesRes.json(),
          catsRes.json(),
          brandsRes.json(),
          suppRes.json(),
        ])
        const arr = <T,>(d: T) =>
          Array.isArray(d) ? d : (d as any)?.data || []
        setLines(arr(linesData))
        setAllCategories(arr(catsData))
        setBrands(arr(brandsData))
        setSuppliers(arr(suppData))
      } catch {
        toast.error('Error', 'No se pudieron cargar los catálogos')
      } finally {
        setLoadingCatalogs(false)
      }
    }
    load()
  }, [open])

  // Reset form when modal closes
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

  // ── Image upload ──────────────────────────────────────────────────

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

  // ── Quick-create helpers ──────────────────────────────────────────

  const handleCreateSupplier = useCallback(
    async (supplierName: string) => {
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
    },
    [],
  )

  const handleCreateBrand = useCallback(
    async (brandName: string) => {
      const res = await createBrand({ name: brandName })
      if (res.success && res.data) {
        const br = { id: res.data.id, name: res.data.name }
        setBrands((prev) => [...prev, br])
        setBrandId(br.id)
        toast.success('Marca creada', brandName)
      } else {
        toast.error('Error', 'No se pudo crear la marca')
      }
    },
    [],
  )

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

  // ── Variant helpers ───────────────────────────────────────────────

  const updateVariant = (key: string, field: keyof VariantRow, value: string) => {
    setVariants((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)),
    )
  }

  const removeVariant = (key: string) => {
    setVariants((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((r) => r._key !== key)
    })
  }

  // ── Validation ────────────────────────────────────────────────────

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
      if (v.quantity === '' || isNaN(parseInt(v.quantity, 10)) || parseInt(v.quantity, 10) < 0)
        return 'La cantidad inicial no puede ser negativa'
    }
    return null
  }

  // ── Submit ────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      toast.error('Datos incompletos', err)
      return
    }

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
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-semibold">
            Nuevo Producto
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Completa los datos base y agrega las variantes (talla / color) que necesites.
          </p>
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ═══ SECCIÓN 1: Datos base ═══════════════════════════════ */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Datos base
            </h3>

            {/* Nombre + Código base — full row */}
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
                  Código base
                  <span className="ml-1 text-xs text-gray-400">(opcional)</span>
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

            {/* Proveedor · Marca · Línea · Categoría · Almacén */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

              {/* Proveedor */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Proveedor <span className="text-red-500">*</span>
                </Label>
                <Combobox
                  options={suppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar proveedor'}
                  disabled={loadingCatalogs}
                  onQuickCreate={handleCreateSupplier}
                  quickCreateLabel="Nuevo proveedor"
                />
              </div>

              {/* Marca */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Marca <span className="text-red-500">*</span>
                </Label>
                <Combobox
                  options={brands}
                  value={brandId}
                  onChange={setBrandId}
                  placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar marca'}
                  disabled={loadingCatalogs}
                  onQuickCreate={handleCreateBrand}
                  quickCreateLabel="Nueva marca"
                />
              </div>

              {/* Línea */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Línea <span className="text-red-500">*</span>
                </Label>
                <Combobox
                  options={lines}
                  value={lineId}
                  onChange={setLineId}
                  placeholder={loadingCatalogs ? 'Cargando…' : 'Seleccionar línea'}
                  disabled={loadingCatalogs}
                />
              </div>

              {/* Categoría */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Categoría <span className="text-red-500">*</span>
                </Label>
                <Combobox
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

              {/* Almacén */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Almacén</Label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {WAREHOUSES.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Imagen del producto</Label>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div
                  className={cn(
                    'flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed',
                    imagePreview
                      ? 'border-transparent'
                      : 'border-gray-200 bg-gray-50',
                  )}
                >
                  {imagePreview ? (
                    <div className="relative h-full w-full">
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="h-24 w-24 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl('')
                          setImagePreview('')
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-gray-900 p-0.5 text-white hover:bg-gray-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  )}
                </div>

                {/* Upload button */}
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
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* ═══ SECCIÓN 2: Variantes ════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Variantes
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-normal text-gray-600">
                  {variants.length} {variants.length === 1 ? 'fila' : 'filas'}
                </span>
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVariants((prev) => [...prev, newRow()])}
                className="h-7 gap-1.5 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar variante
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="grid bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                style={{ gridTemplateColumns: '1fr 90px 140px 110px 110px 90px 36px' }}
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
                {variants.map((row, idx) => (
                  <div
                    key={row._key}
                    className="grid items-center gap-1.5 px-3 py-2"
                    style={{ gridTemplateColumns: '1fr 90px 140px 110px 110px 90px 36px' }}
                  >
                    {/* Barcode */}
                    <Input
                      value={row.barcode}
                      onChange={(e) => updateVariant(row._key, 'barcode', e.target.value)}
                      placeholder="0000000000000"
                      className="h-8 font-mono text-xs"
                    />

                    {/* Size */}
                    <Input
                      value={row.size}
                      onChange={(e) => updateVariant(row._key, 'size', e.target.value)}
                      placeholder="S, M, L…"
                      className="h-8 text-xs"
                    />

                    {/* Color — compact picker */}
                    <CompactColorPicker
                      value={row.color}
                      onChange={(v) => updateVariant(row._key, 'color', v)}
                      placeholder="Color"
                    />

                    {/* Purchase price */}
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.purchase_price}
                      onChange={(e) => updateVariant(row._key, 'purchase_price', e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-xs"
                    />

                    {/* Sale price */}
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.sale_price}
                      onChange={(e) => updateVariant(row._key, 'sale_price', e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-xs"
                    />

                    {/* Quantity */}
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => updateVariant(row._key, 'quantity', e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeVariant(row._key)}
                      disabled={variants.length === 1}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                        variants.length === 1
                          ? 'text-gray-200 cursor-not-allowed'
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
              Cada fila crea un SKU independiente. Para un producto sin talla, deja la columna Talla vacía.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
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
