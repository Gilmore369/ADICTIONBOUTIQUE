'use client'

/**
 * QuickCreateDialog — Modales de creación rápida desde Ingreso Masivo
 *
 * Soporta: supplier | brand | line | category | size
 * Cada tipo tiene los campos mínimos requeridos para evitar registros huérfanos.
 * Al crear, llama onSuccess(id, name) para que el combo seleccione el nuevo registro.
 */

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { createSupplier, createBrand, createCategory, createSize, createLine } from '@/actions/catalogs'
import { createBrowserClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuickCreateType = 'supplier' | 'brand' | 'line' | 'category' | 'size'

interface QuickCreateDialogProps {
  type: QuickCreateType
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the newly created entity's id and name */
  onSuccess: (id: string, name: string) => void
  /** Pre-filled context from parent form */
  lineId?: string      // For category creation
  categoryId?: string  // For size creation
  supplierId?: string  // For brand creation
}

// ─── Field configs ────────────────────────────────────────────────────────────

const META: Record<QuickCreateType, { title: string; description: string }> = {
  supplier: {
    title: 'Crear Proveedor',
    description: 'Registra un proveedor con datos de contacto',
  },
  brand: {
    title: 'Crear Marca',
    description: 'Nueva marca asociada al proveedor seleccionado',
  },
  line: {
    title: 'Crear Línea',
    description: 'Nueva línea de producto (Dama, Caballero, Niños…)',
  },
  category: {
    title: 'Crear Categoría',
    description: 'Nueva categoría dentro de una línea',
  },
  size: {
    title: 'Crear Talla(s)',
    description: 'Una o varias tallas separadas por coma',
  },
}

// ─── Empty form states ────────────────────────────────────────────────────────

const emptySupplier = () => ({
  name: '', contact_name: '', phone: '', email: '', address: '', active: true,
})
const emptyBrand = () => ({ name: '', description: '', active: true })
const emptyLine  = () => ({ name: '', description: '', active: true })
const emptyCategory = () => ({ name: '', description: '', line_id: '', active: true })
const emptySize     = () => ({ names: '', category_id: '', active: true, bulkMode: false })

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickCreateDialog({
  type, open, onOpenChange, onSuccess, lineId, categoryId, supplierId,
}: QuickCreateDialogProps) {

  const [saving, setSaving] = useState(false)

  // Per-type form state
  const [supplier, setSupplier] = useState(emptySupplier)
  const [brand,    setBrand]    = useState(emptyBrand)
  const [line,     setLine]     = useState(emptyLine)
  const [category, setCategory] = useState(() => ({ ...emptyCategory(), line_id: lineId || '' }))
  const [sizeForm, setSizeForm] = useState(() => ({ ...emptySize(), category_id: categoryId || '' }))

  // Catalog lists for selectors
  const [lines,      setLines]      = useState<Array<{ id: string; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)

  // Reset forms when dialog opens for a new type
  useEffect(() => {
    if (!open) return
    setSupplier(emptySupplier())
    setBrand(emptyBrand())
    setLine(emptyLine())
    setCategory({ ...emptyCategory(), line_id: lineId || '' })
    setSizeForm({ ...emptySize(), category_id: categoryId || '' })

    if (type === 'category') loadLines()
    if (type === 'size')     loadCategories()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type])

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
    if (!supplier.name.trim()) { toast.error('El nombre es requerido'); return }
    const fd = new FormData()
    fd.append('name',         supplier.name.trim())
    fd.append('contact_name', supplier.contact_name.trim())
    fd.append('phone',        supplier.phone.trim())
    fd.append('email',        supplier.email.trim())
    fd.append('address',      supplier.address.trim())
    const res = await createSupplier(fd)
    if (res?.success && res.data) {
      toast.success('Proveedor creado')
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear proveedor')
    }
  }

  const saveBrand = async () => {
    if (!brand.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!supplierId)         { toast.error('Selecciona un proveedor primero'); return }
    const fd = new FormData()
    fd.append('name',         brand.name.trim())
    fd.append('description',  brand.description.trim())
    fd.append('supplier_ids[]', supplierId)
    const res = await createBrand(fd)
    if (res?.success && res.data) {
      toast.success('Marca creada')
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear marca')
    }
  }

  const saveLine = async () => {
    if (!line.name.trim()) { toast.error('El nombre es requerido'); return }
    const fd = new FormData()
    fd.append('name',        line.name.trim())
    fd.append('description', line.description.trim())
    const res = await createLine(fd)
    if (res?.success && res.data) {
      toast.success('Línea creada')
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear línea')
    }
  }

  const saveCategory = async () => {
    if (!category.name.trim())    { toast.error('El nombre es requerido'); return }
    if (!category.line_id)        { toast.error('Selecciona una línea'); return }
    const fd = new FormData()
    fd.append('name',        category.name.trim())
    fd.append('line_id',     category.line_id)
    fd.append('description', category.description.trim())
    const res = await createCategory(fd)
    if (res?.success && res.data) {
      toast.success('Categoría creada')
      onSuccess(res.data.id, res.data.name)
      onOpenChange(false)
    } else {
      toast.error(typeof res?.error === 'string' ? res.error : 'Error al crear categoría')
    }
  }

  const saveSizes = async () => {
    if (!sizeForm.names.trim())      { toast.error('Ingresa al menos una talla'); return }
    if (!sizeForm.category_id)       { toast.error('Selecciona una categoría'); return }

    const sizeNames = sizeForm.names.split(',').map(n => n.trim()).filter(Boolean)
    if (!sizeNames.length)           { toast.error('Tallas inválidas'); return }

    let ok = 0; let fail = 0
    let lastId = ''; let lastName = ''

    for (const sizeName of sizeNames) {
      const fd = new FormData()
      fd.append('name',        sizeName)
      fd.append('category_id', sizeForm.category_id)
      const res = await createSize(fd)
      if (res?.success && res.data) { ok++; lastId = res.data.id; lastName = res.data.name }
      else fail++
    }

    if (ok > 0) {
      toast.success(`${ok} talla(s) creada(s)${fail > 0 ? ` · ${fail} fallaron` : ''}`)
      onSuccess(lastId, lastName)
      onOpenChange(false)
    } else {
      toast.error('No se pudo crear ninguna talla')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const meta = META[type]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription className="text-xs">{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── PROVEEDOR ─────────────────────────────────────────────── */}
          {type === 'supplier' && (
            <>
              <Field label="Nombre *">
                <Input
                  autoFocus
                  placeholder="Ej: Distribuidora ABC"
                  value={supplier.name}
                  onChange={e => setSupplier(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>
              <Field label="Contacto">
                <Input
                  placeholder="Nombre del contacto"
                  value={supplier.contact_name}
                  onChange={e => setSupplier(p => ({ ...p, contact_name: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono">
                  <Input
                    type="tel"
                    placeholder="999 888 777"
                    value={supplier.phone}
                    onChange={e => setSupplier(p => ({ ...p, phone: e.target.value }))}
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
              </div>
              <Field label="Dirección">
                <Input
                  placeholder="Av. Principal 123, Lima"
                  value={supplier.address}
                  onChange={e => setSupplier(p => ({ ...p, address: e.target.value }))}
                />
              </Field>
            </>
          )}

          {/* ── MARCA ─────────────────────────────────────────────────── */}
          {type === 'brand' && (
            <>
              {!supplierId && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Selecciona un proveedor en el formulario principal primero.
                </p>
              )}
              <Field label="Nombre *">
                <Input
                  autoFocus
                  placeholder="Ej: Nike, Adidas, Tommy…"
                  value={brand.name}
                  onChange={e => setBrand(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  disabled={!supplierId}
                />
              </Field>
              <Field label="Descripción">
                <Textarea
                  placeholder="Descripción opcional de la marca"
                  value={brand.description}
                  onChange={e => setBrand(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  disabled={!supplierId}
                />
              </Field>
            </>
          )}

          {/* ── LÍNEA ─────────────────────────────────────────────────── */}
          {type === 'line' && (
            <>
              <Field label="Nombre *">
                <Input
                  autoFocus
                  placeholder="Ej: Dama, Caballero, Niños"
                  value={line.name}
                  onChange={e => setLine(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>
              <Field label="Descripción">
                <Textarea
                  placeholder="Descripción opcional"
                  value={line.description}
                  onChange={e => setLine(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
              </Field>
            </>
          )}

          {/* ── CATEGORÍA ─────────────────────────────────────────────── */}
          {type === 'category' && (
            <>
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
              <Field label="Nombre *">
                <Input
                  autoFocus
                  placeholder="Ej: Camisetas, Pantalones, Calzado"
                  value={category.name}
                  onChange={e => setCategory(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>
              <Field label="Descripción">
                <Textarea
                  placeholder="Descripción opcional"
                  value={category.description}
                  onChange={e => setCategory(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
              </Field>
            </>
          )}

          {/* ── TALLA ─────────────────────────────────────────────────── */}
          {type === 'size' && (
            <>
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
              <Field
                label="Talla(s) *"
                hint="Separa varias con comas: S, M, L, XL, XXL"
              >
                <Input
                  autoFocus
                  placeholder="S, M, L, XL, XXL"
                  value={sizeForm.names}
                  onChange={e => setSizeForm(p => ({ ...p, names: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </Field>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Crear'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helper: form field wrapper ───────────────────────────────────────────────

function Field({
  label, hint, children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
