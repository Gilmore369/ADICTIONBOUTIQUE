'use client'

/**
 * Bulk Product Entry Component V2
 * 
 * Ingreso masivo con estructura:
 * - Modelo Base (campos comunes)
 * - Variantes por Talla (cantidad individual)
 * Filters lines and categories by selected store
 * 
 * Design Tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Button height: 36px
 * - Spacing: 8px, 16px
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Save, Package, ChevronDown, ChevronUp, Wand2, Palette, Printer, XCircle, Loader2 } from 'lucide-react'
import { generateBarcodePdf, type BarcodeItem } from '@/lib/barcodes/generate-barcode-pdf'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { createBulkProducts } from '@/actions/products'
import { CompactColorPicker } from '@/components/ui/color-picker'
import { QuickCreateDialog, type QuickCreateType } from './quick-create-dialog'
import { ImageUpload } from '@/components/ui/image-upload'
import { useStore } from '@/contexts/store-context'

interface Size {
  id: string
  name: string
}

interface ColorEntry {
  id: string        // local UUID (React key + update target)
  color: string
  quantity: number
  barcode: string
}

interface SizeVariant {
  sizeId: string
  sizeName: string
  colorEntries: ColorEntry[] // one row per color — each becomes one product
}

interface ExistingVariant {
  productId: string
  barcode: string | null
  size: string | null
  color: string | null
  price: number | null
  purchase_price?: number | null
}

interface ProductModel {
  id: string
  // Campos del modelo base
  baseCode: string
  baseName: string
  lineId: string
  categoryId: string
  brandId: string
  color: string
  imageUrl?: string // Imagen del modelo (compartida por todas las tallas)
  purchasePrice: number
  salePrice: number
  // Variantes por talla (NUEVAS, las que va a crear)
  variants: SizeVariant[]
  // Variantes que YA existen en BD para este base_code (read-only, para mostrar al usuario)
  existingVariants?: ExistingVariant[]
  // UI state
  expanded: boolean
}

export function BulkProductEntryV2() {
  const { storeId, selectedStore, storeName } = useStore()
  const [supplier, setSupplier] = useState('')
  // Auto-select warehouse based on store filter
  const [warehouse, setWarehouse] = useState(() => {
    if (selectedStore === 'HOMBRES') return 'Tienda Hombres'
    if (selectedStore === 'MUJERES') return 'Tienda Mujeres'
    return 'Tienda Mujeres' // Default
  })
  const [models, setModels] = useState<ProductModel[]>([])
  const [saving, setSaving] = useState(false)
  
  // Catalog data
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [lines, setLines] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Quick create dialogs
  const [showSupplierDialog, setShowSupplierDialog] = useState(false)
  const [showBrandDialog, setShowBrandDialog] = useState(false)
  const [showLineDialog, setShowLineDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showSizeDialog, setShowSizeDialog] = useState(false)
  // Tracking unificado: cada dialog recuerda QUÉ modelo lo disparó para auto-seleccionar después
  const [selectedModelForSize, setSelectedModelForSize] = useState<string>('')
  const [selectedModelForLine, setSelectedModelForLine] = useState<string>('')
  const [selectedModelForCategory, setSelectedModelForCategory] = useState<string>('')
  const [selectedModelForBrand, setSelectedModelForBrand] = useState<string>('')

  // Available sizes for current category
  const [availableSizesByCategory, setAvailableSizesByCategory] = useState<{ [categoryId: string]: Size[] }>({})
  
  // Search existing models
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    loadCatalogs()
    // Update warehouse when store filter changes
    if (selectedStore === 'HOMBRES') {
      setWarehouse('Tienda Hombres')
    } else if (selectedStore === 'MUJERES') {
      setWarehouse('Tienda Mujeres')
    }
  }, [storeId, selectedStore]) // Reload when store changes

  // Load brands when supplier changes
  useEffect(() => {
    if (supplier) {
      loadBrandsForSupplier(supplier)
    } else {
      setBrands([])
    }
  }, [supplier])

  const loadBrandsForSupplier = async (supplierId: string) => {
    // Solo carga marcas asociadas al proveedor seleccionado.
    // Eliminado el fallback peligroso que mostraba TODAS las marcas si el proveedor
    // no tenía ninguna asociada — eso permitía asociar marcas equivocadas y
    // crecer datos inconsistentes. Si no hay marcas, el usuario debe crearla con +.
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/brands`)
      const { data } = await response.json()
      setBrands(data || [])
    } catch (error) {
      console.error('[loadBrandsForSupplier] Error loading brands:', error)
      setBrands([])
    }
  }

  const loadCatalogs = async () => {
    try {
      setLoading(true)
      // Load catalogs with store filter
      const params = new URLSearchParams()
      if (storeId) params.append('store_id', storeId)
      
      const [suppliersRes, linesRes] = await Promise.all([
        fetch('/api/catalogs/suppliers'),
        fetch(`/api/catalogs/lines?${params}`)
      ])

      const [suppliersData, linesData] = await Promise.all([
        suppliersRes.json(),
        linesRes.json()
      ])

      setSuppliers(suppliersData.data || [])
      setLines(linesData || [])
      
      // Load categories filtered by store (through lines)
      const categoriesRes = await fetch('/api/catalogs/categories')
      const categoriesData = await categoriesRes.json()
      
      // Filter categories that belong to filtered lines
      const lineIds = (linesData || []).map((l: any) => l.id)
      const filteredCategories = (categoriesData.data || []).filter((cat: any) => 
        lineIds.includes(cat.line_id)
      )
      setCategories(filteredCategories)
      
      // Brands will be loaded when supplier is selected
    } catch (error) {
      console.error('[loadCatalogs] Error loading catalogs:', error)
      toast.error('Error al cargar catálogos')
    } finally {
      setLoading(false)
    }
  }

  // ─── Handlers de creación inline ────────────────────────────────────────
  // Patrón uniforme: tras crear, AUTO-SELECCIONAR la nueva entidad en el modelo
  // que disparó el dialog. El toast de éxito ya lo muestra el QuickCreateDialog.

  const handleSupplierCreated = (id: string, _name: string) => {
    setSuppliers([...suppliers, { id, name: _name }])
    setSupplier(id)  // El proveedor es global al lote, así que selecciona arriba
  }

  const handleBrandCreated = (id: string, name: string) => {
    setBrands([...brands, { id, name }])
    // Auto-seleccionar la marca en el modelo que disparó el dialog
    if (selectedModelForBrand) {
      updateModel(selectedModelForBrand, 'brandId', id)
    }
  }

  const handleLineCreated = (id: string, name: string) => {
    setLines([...lines, { id, name }])
    // Auto-seleccionar la línea en el modelo que disparó el dialog
    if (selectedModelForLine) {
      updateModel(selectedModelForLine, 'lineId', id)
    }
  }

  const handleCategoryCreated = async (id: string, name: string) => {
    // Recargar categorías para tenerla disponible en la lista
    await loadCatalogs()
    // Auto-seleccionar la categoría en el modelo que disparó el dialog
    if (selectedModelForCategory) {
      // updateModel hace lookup por id en categories, por eso primero recargamos
      updateModel(selectedModelForCategory, 'categoryId', id)
    }
  }

  const handleSizeCreated = async (_id: string, _name: string) => {
    // Recargar tallas para la categoría del modelo y auto-marcar las nuevas
    const model = models.find(m => m.id === selectedModelForSize)
    if (model?.categoryId) {
      const previousSizeIds = (availableSizesByCategory[model.categoryId] || []).map(s => s.id)
      const newSizes = await loadSizesForCategory(model.categoryId)
      // Auto-toggle: marcar como seleccionadas las tallas que NO existían antes
      const justCreated = newSizes.filter((s: Size) => !previousSizeIds.includes(s.id))
      for (const s of justCreated) {
        toggleSize(model.id, s)
      }
    }
  }

  const loadSizesForCategory = async (categoryId: string) => {
    // Siempre recargar tallas (no usar cache) para evitar problemas de sincronización
    try {
      const response = await fetch(`/api/catalogs/sizes?category_id=${categoryId}`)
      const { data } = await response.json()
      
      const sizes = data || []
      console.log('[loadSizesForCategory] Loaded sizes for category', categoryId, ':', sizes)
      
      setAvailableSizesByCategory(prev => ({
        ...prev,
        [categoryId]: sizes
      }))
      return sizes
    } catch (error) {
      console.error('[loadSizesForCategory] Error loading sizes:', error)
      return []
    }
  }

  // Buscar modelos existentes por nombre base
  const searchExistingModels = async (query: string) => {
    if (!query.trim() || !supplier) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const response = await fetch(
        `/api/products/search-by-name?baseName=${encodeURIComponent(query)}&supplier_id=${supplier}`
      )
      const { data } = await response.json()
      setSearchResults(data || [])
    } catch (error) {
      console.error('Error searching models:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Cargar modelo existente en el formulario
  const loadExistingModel = async (existingModel: any) => {
    const baseCode = existingModel.baseCode

    const newModel: ProductModel = {
      id: crypto.randomUUID(),
      baseCode: baseCode,
      baseName: existingModel.baseName,
      lineId: existingModel.lineId || '',
      categoryId: existingModel.categoryId || '',
      brandId: existingModel.brandId || '',
      color: '',
      imageUrl: existingModel.imageUrl || '',
      purchasePrice: existingModel.purchasePrice || 0,
      salePrice: existingModel.salePrice || 0,
      variants: [],
      existingVariants: existingModel.variants || [],
      expanded: true,
    }

    if (newModel.categoryId) {
      await loadSizesForCategory(newModel.categoryId)
    }

    setModels([...models, newModel])
    setSearchQuery('')
    setSearchResults([])
    const existingCount = existingModel.variants?.length || 0
    toast.success(
      `Modelo "${existingModel.baseName}" cargado`,
      `${existingCount} variante(s) ya existen en BD · Agrega tallas/colores nuevos`
    )
  }

  const addModel = () => {
    setModels([
      ...models,
      {
        id: crypto.randomUUID(),
        baseCode: '',
        baseName: '',
        lineId: '',
        categoryId: '',
        brandId: '',
        color: '',
        imageUrl: '',
        purchasePrice: 0,
        salePrice: 0,
        variants: [],
        expanded: true
      }
    ])
  }

  const removeModel = (id: string) => {
    setModels(models.filter(m => m.id !== id))
  }

  const updateModel = async (id: string, field: keyof ProductModel, value: any) => {
    // Auto-update global warehouse when line changes
    if (field === 'lineId' && value) {
      const line = lines.find((l: any) => l.id === value)
      if (line) {
        const n = (line.name as string).toLowerCase()
        if (n.includes('hombre')) setWarehouse('Tienda Hombres')
        else if (n.includes('mujer') || n.includes('niño') || n.includes('nino')) setWarehouse('Tienda Mujeres')
      }
    }

    // Si cambia la categoría, cargar tallas ANTES de actualizar el estado
    if (field === 'categoryId' && value) {
      console.log('[updateModel] Category changed to:', value)

      // Capturar el modelo actual ANTES de actualizar estado
      const currentModel = models.find(m => m.id === id)

      // Cargar tallas y esperar a que termine
      await loadSizesForCategory(value)

      // Actualizar estado con nueva categoría, resetear variantes, mantener expanded
      setModels(prev => prev.map(m =>
        m.id === id
          ? { ...m, categoryId: value, variants: [], expanded: true }
          : m
      ))

      // Auto-generate code if not already set
      if (!currentModel?.baseCode) {
        generateCodeForModel(id, value, currentModel?.brandId)
      }
    } else {
      // Para otros campos, actualizar normalmente
      setModels(prev => prev.map(m =>
        m.id === id
          ? { ...m, [field]: value }
          : m
      ))

      // Si cambia la marca y NO hay base_code aún, regenerar con marca incluida
      if (field === 'brandId' && value) {
        const m = models.find(mm => mm.id === id)
        if (m && m.categoryId && !m.baseCode) {
          generateCodeForModel(id, m.categoryId, value)
        }
      }
    }
  }

  // Generar código base. Formato: {MARCA}-{CATEGORIA}-{NUM} si hay marca,
  // o {CATEGORIA}-{NUM} si no. Ej: NIK-BIL-001 o BIL-001
  const generateCodeForModel = async (modelId: string, categoryId: string, brandId?: string) => {
    try {
      const params = new URLSearchParams({ category_id: categoryId })
      if (brandId) params.set('brand_id', brandId)
      const response = await fetch(`/api/catalogs/next-code?${params.toString()}`)
      const { data, error } = await response.json()

      if (error) {
        console.error('[generateCodeForModel] Error:', error)
        return
      }

      // Actualizar código directamente sin llamar a updateModel para evitar conflictos
      setModels(prev => prev.map(m =>
        m.id === modelId
          ? { ...m, baseCode: data.code }
          : m
      ))
    } catch (error) {
      console.error('[generateCodeForModel] Error generating code:', error)
    }
  }

  // Desactivar una variante legacy directamente desde el banner amber
  const [deactivating, setDeactivating] = useState<string | null>(null) // product_id en proceso

  const deactivateVariant = async (modelId: string, productId: string, label: string) => {
    setDeactivating(productId)
    try {
      const res = await fetch('/api/products/deactivate-variant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error('No se pudo desactivar', json.error || 'Error desconocido')
        return
      }
      // Quitar la variante del listado local
      setModels(prev => prev.map(m => {
        if (m.id !== modelId) return m
        return { ...m, existingVariants: (m.existingVariants || []).filter(v => v.productId !== productId) }
      }))
      toast.success(`Variante "${label}" desactivada`, 'Ya no aparecerá en el catálogo visual')
    } catch (e) {
      toast.error('Error de red al desactivar variante')
    } finally {
      setDeactivating(null)
    }
  }

  // Detectar variantes existentes cuando el usuario digita un base_code que ya existe.
  // Buscamos SIN filtrar por proveedor para detectar CUALQUIER variante antigua,
  // incluyendo las de proveedores distintos (ej: M/L creadas antes del catálogo de tallas).
  const checkExistingByBaseCode = async (modelId: string, baseCode: string) => {
    if (!baseCode || baseCode.length < 3) return
    try {
      // Pasar supplier si hay uno seleccionado (mejora relevancia), pero no requerirlo
      const params = new URLSearchParams({ baseName: baseCode })
      if (supplier) params.set('supplier_id', supplier)
      const res = await fetch(`/api/products/search-by-name?${params}`)
      const { data } = await res.json()
      // Buscar coincidencia exacta de base_code (no solo ilike parcial)
      const match = (data || []).find(
        (m: any) => m.baseCode === baseCode || m.baseCode?.toUpperCase() === baseCode.toUpperCase()
      )
      if (match && match.variants?.length > 0) {
        setModels(prev => prev.map(m => {
          if (m.id !== modelId) return m
          // Solo sobreescribir si aún no tiene variantes existentes (buscador ya las trae)
          if (m.existingVariants && m.existingVariants.length > 0) return m
          return { ...m, existingVariants: match.variants }
        }))
      }
    } catch {
      // Silencioso — solo es un aviso preventivo
    }
  }

  const toggleSize = (modelId: string, size: Size) => {
    setModels(prev => prev.map(m => {
      if (m.id !== modelId) return m
      const exists = m.variants.findIndex(v => v.sizeId === size.id)
      if (exists >= 0) {
        return { ...m, variants: m.variants.filter(v => v.sizeId !== size.id) }
      }
      return {
        ...m,
        variants: [
          ...m.variants,
          {
            sizeId: size.id,
            sizeName: size.name,
            colorEntries: [{
              id: crypto.randomUUID(),
              color: m.color || '',
              quantity: 0,
              barcode: '',
            }],
          },
        ],
      }
    }))
  }

  // ── Color-entry CRUD ────────────────────────────────────────────────────────
  const addColorEntry = (modelId: string, sizeId: string) => {
    const model = models.find(m => m.id === modelId)
    setModels(prev => prev.map(m => {
      if (m.id !== modelId) return m
      return {
        ...m,
        variants: m.variants.map(v => {
          if (v.sizeId !== sizeId) return v
          return {
            ...v,
            colorEntries: [
              ...v.colorEntries,
              { id: crypto.randomUUID(), color: '', quantity: 0, barcode: '' },
            ],
          }
        }),
      }
    }))
  }

  const removeColorEntry = (modelId: string, sizeId: string, entryId: string) => {
    setModels(prev => prev.map(m => {
      if (m.id !== modelId) return m
      return {
        ...m,
        variants: m.variants.map(v => {
          if (v.sizeId !== sizeId) return v
          const remaining = v.colorEntries.filter(e => e.id !== entryId)
          // Last entry removed → uncheck size entirely
          if (remaining.length === 0) return null as any
          return { ...v, colorEntries: remaining }
        }).filter(Boolean),
      }
    }))
  }

  const updateColorEntry = (
    modelId: string,
    sizeId: string,
    entryId: string,
    field: 'color' | 'quantity' | 'barcode',
    value: string | number,
  ) => {
    setModels(prev => prev.map(m => {
      if (m.id !== modelId) return m
      return {
        ...m,
        variants: m.variants.map(v => {
          if (v.sizeId !== sizeId) return v
          return {
            ...v,
            colorEntries: v.colorEntries.map(e =>
              e.id === entryId ? { ...e, [field]: value } : e
            ),
          }
        }),
      }
    }))
  }

  const toggleExpanded = (modelId: string) => {
    setModels(models.map(m =>
      m.id === modelId ? { ...m, expanded: !m.expanded } : m
    ))
  }

  const getTotalUnits = (model: ProductModel) => {
    return model.variants.reduce(
      (sum, v) => sum + v.colorEntries.reduce((s, e) => s + (e.quantity || 0), 0),
      0
    )
  }

  // Función para resetear formulario después de guardar
  const resetForm = () => {
    // Limpiar búsqueda
    setSearchQuery('')
    setSearchResults([])
    
    // Crear un modelo vacío nuevo
    const newEmptyModel: ProductModel = {
      id: crypto.randomUUID(),
      baseCode: '',
      baseName: '',
      lineId: '',
      categoryId: '',
      brandId: '',
      color: '',
      imageUrl: '',
      purchasePrice: 0,
      salePrice: 0,
      variants: [],
      expanded: true
    }
    
    // Reemplazar todos los modelos con uno vacío
    setModels([newEmptyModel])
    
    // Limpiar el caché de tallas también
    setAvailableSizesByCategory({})
    
    // Mantener proveedor y tienda para facilitar carga continua
  }

  // Función generateCode eliminada - ahora es automático al seleccionar categoría

  const handleSave = async () => {
    // Validación 1: Proveedor es obligatorio
    if (!supplier) {
      toast.error('Selecciona un proveedor antes de guardar')
      return
    }

    // Validación 2: Verificar que cada modelo tenga los campos requeridos
    const invalidModels = models.filter(m => {
      const hasUnits = getTotalUnits(m) > 0
      return hasUnits && (!m.baseCode || !m.baseName || !m.categoryId || !m.brandId)
    })

    if (invalidModels.length > 0) {
      toast.error('Completa todos los campos requeridos', 
        'Cada modelo debe tener: Código, Nombre, Categoría, Marca y al menos 1 talla con cantidad')
      return
    }

    // Validación 3: Filtrar modelos válidos (con unidades y campos completos)
    const validModels = models.filter(m =>
      m.baseCode && m.baseName && m.categoryId && m.brandId && getTotalUnits(m) > 0
    )

    if (validModels.length === 0) {
      toast.error('Agrega al menos un modelo completo', 
        'Debes tener al menos un modelo con todos los campos requeridos y tallas con cantidades')
      return
    }

    // Validación 4: Códigos de barras duplicados entre variantes
    const allBarcodes: string[] = []
    for (const m of validModels) {
      for (const v of m.variants) {
        for (const entry of v.colorEntries) {
          if ((entry.quantity || 0) <= 0) continue
          const colorSlug = (entry.color || '').replace(/\s+/g, '-').toUpperCase() || 'SIN-COLOR'
          const code = entry.barcode.trim() || `${m.baseCode}-${v.sizeName}-${colorSlug}`
          allBarcodes.push(code)
        }
      }
    }
    const dup = allBarcodes.find((b, i) => allBarcodes.indexOf(b) !== i)
    if (dup) {
      toast.error('Código de barras duplicado',
        `"${dup}" se repite — cada variante necesita un código único`)
      return
    }

    setSaving(true)

    try {
      const productsToCreate = validModels.flatMap(model =>
        model.variants.flatMap(variant =>
          variant.colorEntries
            .filter(entry => (entry.quantity || 0) > 0)
            .map(entry => {
              const colorSlug = (entry.color || '').replace(/\s+/g, '-').toUpperCase() || 'SIN-COLOR'
              const autoBarcode = `${model.baseCode}-${variant.sizeName}-${colorSlug}`
              return {
                barcode: entry.barcode.trim() || autoBarcode,
                name: `${model.baseName} - ${variant.sizeName}`,
                base_code: model.baseCode,
                base_name: model.baseName,
                description: `${model.baseName} talla ${variant.sizeName}${entry.color ? ` color ${entry.color}` : ''}`,
                size: variant.sizeName,
                color: entry.color || model.color,
                image_url: model.imageUrl || null,
                line_id: model.lineId,
                category_id: model.categoryId,
                brand_id: model.brandId,
                supplier_id: supplier,
                purchase_price: model.purchasePrice,
                price: model.salePrice,
                quantity: entry.quantity,
                warehouse_id: warehouse,
              }
            })
        )
      )

      const result = await createBulkProducts(productsToCreate)

      if (result.success) {
        // Generar PDF de etiquetas con códigos de barra (1 por unidad)
        try {
          const barcodeItems: BarcodeItem[] = productsToCreate.map(p => ({
            barcode: p.barcode,
            name: p.base_name || p.name,
            size: p.size,
            color: p.color,
            price: p.price,
            quantity: p.quantity,
          }))
          const totalLabels = barcodeItems.reduce((s, x) => s + (x.quantity || 0), 0)
          generateBarcodePdf(barcodeItems, {
            title: `Adiction Boutique — Lote ${new Date().toLocaleDateString('es-PE')}`,
            showPrice: true,
          })
          toast.success(
            'Productos creados · Etiquetas generadas',
            `${result.data.count} SKUs · ${totalLabels} etiquetas en PDF`
          )
        } catch (pdfErr) {
          // Si falla el PDF, no bloqueamos el flujo
          console.error('[barcode-pdf] Error:', pdfErr)
          toast.success(
            'Productos creados',
            `${result.data.count} productos registrados (PDF de etiquetas falló)`
          )
        }

        // Resetear formulario manteniendo proveedor y tienda para carga continua
        resetForm()
      } else {
        toast.error(
          'Error al crear productos',
          typeof result.error === 'string' ? result.error : 'Error desconocido'
        )
      }
    } catch (error) {
      console.error('Error saving products:', error)
      toast.error('Error inesperado', error instanceof Error ? error.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (models.length === 0) {
      addModel()
    }
  }, [models])

  return (
    <div className="space-y-6">
      {/* Header Config */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900 font-medium mb-1">
              📋 Flujo de Ingreso Masivo
            </p>
            <p className="text-xs text-blue-700">
              1. Selecciona un <strong>Proveedor</strong> (requerido) • 
              2. Para cada modelo: selecciona <strong>Categoría</strong> (genera código automático) • 
              3. Selecciona <strong>Marca</strong> • 
              4. Agrega <strong>Tallas</strong> con cantidades • 
              5. Guarda todo
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>
                Proveedor <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                {/* SearchableSelect: permite filtrar escribiendo (útil con +100 proveedores) */}
                <div className="flex-1">
                  <SearchableSelect
                    options={suppliers.map((s: any) => ({
                      value: s.id,
                      label: s.name,
                      hint: s.ruc ? `RUC ${s.ruc}` : undefined,
                    }))}
                    value={supplier}
                    onChange={setSupplier}
                    disabled={loading}
                    invalid={!supplier}
                    placeholder={loading ? 'Cargando…' : 'Seleccionar proveedor'}
                    searchPlaceholder="Escribe nombre o RUC…"
                    emptyMessage="No se encontró ningún proveedor"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSupplierDialog(true)}
                  title="Crear proveedor"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {!supplier && (
                <p className="text-xs text-red-500 mt-1">
                  Debes seleccionar un proveedor antes de agregar modelos
                </p>
              )}
            </div>

            <div>
              <Label>Tienda Destino <span className="text-red-500">*</span></Label>
              <Select 
                value={warehouse} 
                onValueChange={setWarehouse}
                disabled={selectedStore !== 'ALL'} // Lock when store filter is active
              >
                <SelectTrigger className={selectedStore !== 'ALL' ? 'bg-muted/30' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tienda Mujeres">Tienda Mujeres</SelectItem>
                  <SelectItem value="Tienda Hombres">Tienda Hombres</SelectItem>
                </SelectContent>
              </Select>
              {selectedStore !== 'ALL' && (
                <p className="text-xs text-blue-600 mt-1">
                  🔒 Bloqueado por filtro de tienda: {storeName}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Search Existing Models */}
      {supplier && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-semibold text-blue-900">
                Buscar Modelo Existente
              </Label>
            </div>
            <p className="text-xs text-blue-700">
              Busca un modelo existente para agregar un nuevo color. El sistema mantendrá el mismo código base para agrupar todos los colores en el catálogo visual.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: Chaleco Army, Blusa Casual..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchExistingModels(e.target.value)
                }}
                disabled={searching}
                className="flex-1"
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((model, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadExistingModel(model)}
                    className="w-full p-3 text-left bg-card border border-blue-200 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{model.baseName}</p>
                        <p className="text-xs text-muted-foreground">
                          Código: <span className="font-mono">{model.baseCode}</span> · {model.variants?.length || 0} variante(s) en BD
                        </p>
                        {/* Tallas existentes */}
                        {model.sizes && model.sizes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">Tallas:</span>
                            {model.sizes.map((s: string) => (
                              <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium dark:bg-blue-950 dark:text-blue-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Colores existentes */}
                        {model.colors && model.colors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground">Colores:</span>
                            {model.colors.map((c: string) => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded font-medium dark:bg-violet-950 dark:text-violet-300">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium flex-shrink-0 dark:bg-blue-900 dark:text-blue-200">
                        Cargar
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searching && (
              <div className="text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            )}
          </div>
        </Card>
      )}
      {models.map((model, index) => {
        const categorySizes = model.categoryId ? availableSizesByCategory[model.categoryId] || [] : []
        
        return (
          <Card key={model.id} className="overflow-hidden">
            {/* Model Header */}
            <div 
              className="p-4 bg-muted/30 border-b flex items-center justify-between cursor-pointer"
              onClick={() => toggleExpanded(model.id)}
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">
                    Modelo {index + 1}
                    {model.baseName && `: ${model.baseName}`}
                  </h3>
                  {getTotalUnits(model) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {getTotalUnits(model)} unidades · {model.variants.length} talla{model.variants.length !== 1 ? 's' : ''} · {model.variants.reduce((s, v) => s + v.colorEntries.length, 0)} color{model.variants.reduce((s, v) => s + v.colorEntries.length, 0) !== 1 ? 'es' : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getTotalUnits(model) > 0 && (
                  <Badge variant="secondary">
                    {getTotalUnits(model)} unidades
                  </Badge>
                )}
                {models.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeModel(model.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {model.expanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground/70" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground/70" />
                )}
              </div>
            </div>

            {/* Model Content */}
            {model.expanded && (
              <div className="p-4 space-y-4">
                {/* Info banner - always show to explain base_code */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-1">
                    📦 Código Base: {model.baseCode || 'Se generará automáticamente'}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {model.baseCode
                      ? 'Este modelo agrupará todos los colores en la misma tarjeta del catálogo visual.'
                      : (
                        <>
                          Se genera al seleccionar <strong>categoría</strong> (y opcionalmente marca).
                          Formato: <code className="bg-card px-1 py-0.5 rounded text-[10px]">MARCA-CATEGORÍA-NÚMERO</code>
                          {' '}(ej: <code className="bg-card px-1 py-0.5 rounded text-[10px]">NIK-BIL-001</code>) o <code className="bg-card px-1 py-0.5 rounded text-[10px]">CATEGORÍA-NÚMERO</code> si no eliges marca.
                        </>
                      )}
                  </p>
                </div>

                {/* ⚠ Variantes existentes en BD (cuando se cargó un modelo existente o se detectó por base_code) */}
                {model.existingVariants && model.existingVariants.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded-lg p-3">
                    <p className="text-sm text-amber-900 dark:text-amber-200 font-semibold mb-1 flex items-center gap-1.5">
                      ⚠ Este modelo ya tiene {model.existingVariants.length} variante(s) en el catálogo
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                      Estas variantes ya existen y aparecen en el catálogo visual. Si alguna es incorrecta
                      (ej: tallas antiguas como "M" o "L" que ya no usas), puedes
                      <strong> Desactivarlas</strong> aquí para que dejen de aparecer.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-amber-900 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800">
                            <th className="text-left pb-1.5 pr-3">Código de Barras</th>
                            <th className="text-left pb-1.5 pr-3">Talla</th>
                            <th className="text-left pb-1.5 pr-3">Color</th>
                            <th className="text-right pb-1.5 pr-3">Precio</th>
                            <th className="text-right pb-1.5">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.existingVariants.map((v) => {
                            const label = [v.size, v.color].filter(Boolean).join(' / ') || v.barcode || v.productId
                            const isDeactivating = deactivating === v.productId
                            return (
                              <tr key={v.productId} className="border-t border-amber-200 dark:border-amber-900">
                                <td className="py-1.5 pr-3 font-mono text-amber-900 dark:text-amber-300">{v.barcode || '—'}</td>
                                <td className="py-1.5 pr-3 font-semibold text-amber-900 dark:text-amber-200">{v.size || '—'}</td>
                                <td className="py-1.5 pr-3 text-amber-800 dark:text-amber-300">{v.color || '—'}</td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-amber-800 dark:text-amber-300">
                                  {v.price != null ? `S/ ${Number(v.price).toFixed(2)}` : '—'}
                                </td>
                                <td className="py-1.5 text-right">
                                  <button
                                    type="button"
                                    disabled={isDeactivating}
                                    onClick={() => deactivateVariant(model.id, v.productId, label)}
                                    title={`Desactivar "${label}" — dejará de aparecer en el catálogo`}
                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900 disabled:opacity-50 transition-colors"
                                  >
                                    {isDeactivating
                                      ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                      : <XCircle className="h-2.5 w-2.5" />
                                    }
                                    {isDeactivating ? 'Desactivando…' : 'Desactivar'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Base Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">
                      Código Base <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Se genera al seleccionar categoría"
                        value={model.baseCode}
                        onChange={e => updateModel(model.id, 'baseCode', e.target.value.toUpperCase())}
                        onBlur={e => checkExistingByBaseCode(model.id, e.target.value.toUpperCase().trim())}
                        className={`flex-1 font-mono ${!model.baseCode ? 'border-red-300' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => model.categoryId && generateCodeForModel(model.id, model.categoryId, model.brandId)}
                        disabled={!model.categoryId}
                        title="Generar código automáticamente"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {model.baseCode
                        ? 'Código del modelo (compartido por todos los colores)'
                        : 'Se genera al seleccionar categoría · o escribe uno manualmente'}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">
                      Nombre Base <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Ej: Blusa Casual Verano"
                      value={model.baseName}
                      onChange={e => updateModel(model.id, 'baseName', e.target.value)}
                      className={!model.baseName ? 'border-red-300' : ''}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Línea</Label>
                    <div className="flex gap-2">
                      <Select
                        value={model.lineId}
                        onValueChange={value => updateModel(model.id, 'lineId', value)}
                        disabled={loading}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar"} />
                        </SelectTrigger>
                        <SelectContent>
                          {lines.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => { setSelectedModelForLine(model.id); setShowLineDialog(true) }}
                        title="Crear línea"
                        disabled={loading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Categoría <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={model.categoryId}
                        onValueChange={value => updateModel(model.id, 'categoryId', value)}
                        disabled={loading}
                      >
                        <SelectTrigger className={`flex-1 ${!model.categoryId ? 'border-red-300' : ''}`}>
                          <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar"} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter(c => !model.lineId || c.line_id === model.lineId)
                            .map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => { setSelectedModelForCategory(model.id); setShowCategoryDialog(true) }}
                        disabled={!model.lineId || loading}
                        title={!model.lineId ? 'Selecciona una línea primero' : 'Crear categoría'}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {!model.categoryId && (
                      <p className="text-xs text-red-500 mt-1">
                        Requerido para generar el código del producto
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Color Base <span className="text-red-500">*</span>
                    </Label>
                    <CompactColorPicker
                      value={model.color}
                      onChange={value => updateModel(model.id, 'color', value)}
                      placeholder="Color del modelo"
                    />
                    <p className="text-xs text-muted-foreground">
                      {model.baseCode
                        ? '⚠️ Ingresa el NUEVO color que quieres agregar a este modelo'
                        : 'Se aplica a todas las tallas. Puedes personalizar por talla más abajo.'}
                    </p>
                  </div>

                  <div>
                    <ImageUpload
                      label="Imagen (opcional)"
                      value={model.imageUrl}
                      base_code={model.baseCode || undefined}
                      onChange={value => updateModel(model.id, 'imageUrl', value)}
                      onRemove={() => updateModel(model.id, 'imageUrl', '')}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Imagen compartida por todas las tallas del modelo
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Marca <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={model.brandId}
                        onValueChange={value => updateModel(model.id, 'brandId', value)}
                        disabled={loading}
                      >
                        <SelectTrigger className={`flex-1 ${!model.brandId ? 'border-red-300' : ''}`}>
                          <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar"} />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => { setSelectedModelForBrand(model.id); setShowBrandDialog(true) }}
                        title={!supplier ? 'Selecciona un proveedor primero' : 'Crear marca'}
                        disabled={loading || !supplier}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {supplier && brands.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Este proveedor no tiene marcas. Crea una con el botón +
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">
                      Precio Compra <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={model.purchasePrice || ''}
                      onChange={e => updateModel(model.id, 'purchasePrice', Number(e.target.value))}
                      className={!model.purchasePrice || model.purchasePrice <= 0 ? 'border-red-300' : ''}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">
                      Precio Venta <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={model.salePrice || ''}
                      onChange={e => updateModel(model.id, 'salePrice', Number(e.target.value))}
                      className={!model.salePrice || model.salePrice <= 0 ? 'border-red-300' : ''}
                    />
                  </div>
                </div>

                {/* Size Selection */}
                {model.categoryId && categorySizes.length > 0 && (
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-sm font-semibold">
                      Seleccionar Tallas <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Selecciona al menos una talla y asigna cantidades · También puedes crear una nueva con el botón <kbd className="px-1 bg-muted rounded text-[10px]">+ Nueva</kbd>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {categorySizes.map(size => {
                        const isSelected = model.variants.some(v => v.sizeId === size.id)
                        return (
                          <label
                            key={size.id}
                            className={`
                              flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors
                              ${isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                : 'border-border hover:border-gray-300'
                              }
                            `}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSize(model.id, size)}
                            />
                            <span className="text-sm font-medium">{size.name}</span>
                          </label>
                        )
                      })}

                      {/* "+ Nueva talla" chip — abre el quick-create dialog */}
                      <button
                        type="button"
                        onClick={() => { setSelectedModelForSize(model.id); setShowSizeDialog(true) }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm font-medium"
                        title="Crear una nueva talla para esta categoría"
                      >
                        <Plus className="h-4 w-4" />
                        Nueva talla
                      </button>
                    </div>
                    {model.variants.length === 0 && (
                      <p className="text-xs text-red-500">
                        Debes seleccionar al menos una talla
                      </p>
                    )}
                  </div>
                )}

                {/* Variants Table — grouped by size, multiple colors per size */}
                {model.variants.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold">
                        Variantes por Talla y Color
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {model.variants.reduce((s, v) => s + v.colorEntries.length, 0)} fila(s) ·{' '}
                        {getTotalUnits(model)} unidades
                      </span>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 border-b">
                          <tr>
                            <th className="text-left p-2.5 font-semibold w-20">Talla</th>
                            <th className="text-left p-2.5 font-semibold">Color</th>
                            <th className="text-left p-2.5 font-semibold">Código de Barras</th>
                            <th className="text-center p-2.5 font-semibold w-24">Cantidad</th>
                            <th className="w-8" />
                          </tr>
                        </thead>

                        {model.variants.map((variant, vIdx) => (
                          <tbody key={variant.sizeId} className={vIdx > 0 ? 'border-t-2 border-border' : ''}>
                            {variant.colorEntries.map((entry, eIdx) => (
                              <tr
                                key={entry.id}
                                className={eIdx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}
                              >
                                {/* Size cell — only on first color row */}
                                {eIdx === 0 ? (
                                  <td className="p-2.5 align-top">
                                    <span className="inline-flex items-center gap-1 font-bold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                                      {variant.sizeName}
                                    </span>
                                  </td>
                                ) : (
                                  <td className="p-2.5">
                                    <span className="pl-2 text-xs text-muted-foreground">↳</span>
                                  </td>
                                )}

                                {/* Color picker */}
                                <td className="p-2.5 min-w-[150px]">
                                  <CompactColorPicker
                                    value={entry.color}
                                    onChange={v => updateColorEntry(model.id, variant.sizeId, entry.id, 'color', v)}
                                    placeholder={model.color || 'Color'}
                                  />
                                </td>

                                {/* Barcode */}
                                <td className="p-2.5 min-w-[180px]">
                                  <Input
                                    type="text"
                                    placeholder={`${model.baseCode || 'COD'}-${variant.sizeName}-${(entry.color || 'COLOR').replace(/\s+/g,'-').toUpperCase()}`}
                                    value={entry.barcode}
                                    onChange={e => updateColorEntry(model.id, variant.sizeId, entry.id, 'barcode', e.target.value)}
                                    className="font-mono text-xs h-8"
                                    autoComplete="off"
                                  />
                                </td>

                                {/* Quantity */}
                                <td className="p-2.5">
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={entry.quantity || ''}
                                    onChange={e => updateColorEntry(model.id, variant.sizeId, entry.id, 'quantity', Number(e.target.value) || 0)}
                                    className="text-center font-mono h-8"
                                  />
                                </td>

                                {/* Delete color entry */}
                                <td className="p-2.5">
                                  <button
                                    type="button"
                                    onClick={() => removeColorEntry(model.id, variant.sizeId, entry.id)}
                                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded"
                                    title="Quitar este color"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {/* "+ Agregar color" row */}
                            <tr className="bg-muted/10">
                              <td />
                              <td colSpan={4} className="px-2.5 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => addColorEntry(model.id, variant.sizeId)}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                  <Palette className="h-3.5 w-3.5" />
                                  + Agregar color a talla {variant.sizeName}
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        ))}
                      </table>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Cada fila de color genera un producto independiente. El código de barras se auto-genera si lo dejas vacío. Puedes escanear con lector de barras.
                    </p>
                  </div>
                )}

                {model.categoryId && categorySizes.length === 0 && (
                  <div className="border-t pt-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Esta categoría no tiene tallas configuradas
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowSizeDialog(true)
                        setSelectedModelForSize(model.id)
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Crear Tallas
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={addModel} 
          className="gap-2"
          disabled={saving}
        >
          <Plus className="h-4 w-4" />
          Agregar Modelo
        </Button>

        <Button 
          onClick={handleSave} 
          className="gap-2 ml-auto"
          disabled={saving || models.length === 0}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : `Guardar Todo (${models.reduce((sum, m) => sum + getTotalUnits(m), 0)} productos)`}
        </Button>
      </div>

      {/* ─── Quick Create Dialogs ─────────────────────────────────────── */}
      {/* Cada dialog recibe contexto del modelo que lo disparó:
          - Para 'brand': supplierName/Id (proveedor global)
          - Para 'category': lineName/Id del modelo seleccionado
          - Para 'size': categoryName/Id del modelo seleccionado
         Esto permite mostrar chips contextuales y bloquear selectores redundantes. */}

      <QuickCreateDialog
        type="supplier"
        open={showSupplierDialog}
        onOpenChange={setShowSupplierDialog}
        onSuccess={handleSupplierCreated}
      />

      <QuickCreateDialog
        type="brand"
        open={showBrandDialog}
        onOpenChange={setShowBrandDialog}
        onSuccess={handleBrandCreated}
        supplierId={supplier}
        supplierName={suppliers.find((s: any) => s.id === supplier)?.name}
      />

      <QuickCreateDialog
        type="line"
        open={showLineDialog}
        onOpenChange={setShowLineDialog}
        onSuccess={handleLineCreated}
      />

      <QuickCreateDialog
        type="category"
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        onSuccess={handleCategoryCreated}
        lineId={models.find(m => m.id === selectedModelForCategory)?.lineId}
        lineName={lines.find((l: any) => l.id === models.find(m => m.id === selectedModelForCategory)?.lineId)?.name}
      />

      <QuickCreateDialog
        type="size"
        open={showSizeDialog}
        onOpenChange={setShowSizeDialog}
        onSuccess={handleSizeCreated}
        categoryId={models.find(m => m.id === selectedModelForSize)?.categoryId}
        categoryName={categories.find((c: any) => c.id === models.find(m => m.id === selectedModelForSize)?.categoryId)?.name}
      />
    </div>
  )
}
