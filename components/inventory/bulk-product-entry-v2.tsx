'use client'

/**
 * Bulk Product Entry Component V2
 * 
 * Ingreso masivo con estructura:
 * - Modelo Base (campos comunes)
 * - Variantes por Talla (cantidad individual)
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
import { Plus, Trash2, Save, Package, ChevronDown, ChevronUp, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { createBulkProducts } from '@/actions/products'
import { ColorPicker } from '@/components/ui/color-picker'
import { QuickCreateDialog, type QuickCreateType } from './quick-create-dialog'
import { ImageUpload } from '@/components/ui/image-upload'

interface Size {
  id: string
  name: string
}

interface SizeVariant {
  sizeId: string
  sizeName: string
  quantity: number
  color?: string // Color específico para esta variante (opcional)
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
  // Variantes por talla
  variants: SizeVariant[]
  // UI state
  expanded: boolean
}

export function BulkProductEntryV2() {
  const [supplier, setSupplier] = useState('')
  const [warehouse, setWarehouse] = useState('Tienda Mujeres')
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
  const [selectedModelForSize, setSelectedModelForSize] = useState<string>('')
  const [selectedModelForDialog, setSelectedModelForDialog] = useState<string>('')

  // Available sizes for current category
  const [availableSizesByCategory, setAvailableSizesByCategory] = useState<{ [categoryId: string]: Size[] }>({})
  
  // Search existing models
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    loadCatalogs()
  }, [])

  // Load brands when supplier changes
  useEffect(() => {
    if (supplier) {
      loadBrandsForSupplier(supplier)
    } else {
      setBrands([])
    }
  }, [supplier])

  const loadBrandsForSupplier = async (supplierId: string) => {
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
      // Load only essential catalogs first (suppliers and lines)
      // Brands and categories will be loaded on-demand
      const [suppliersRes, linesRes] = await Promise.all([
        fetch('/api/catalogs/suppliers'),
        fetch('/api/catalogs/lines')
      ])

      const [suppliersData, linesData] = await Promise.all([
        suppliersRes.json(),
        linesRes.json()
      ])

      setSuppliers(suppliersData.data || [])
      setLines(linesData.data || [])
      
      // Load categories separately to reduce initial payload
      const categoriesRes = await fetch('/api/catalogs/categories')
      const categoriesData = await categoriesRes.json()
      setCategories(categoriesData.data || [])
      
      // Brands will be loaded when supplier is selected
    } catch (error) {
      console.error('[loadCatalogs] Error loading catalogs:', error)
      toast.error('Error al cargar catálogos')
    } finally {
      setLoading(false)
    }
  }

  // Handle quick create success
  const handleSupplierCreated = (id: string, name: string) => {
    setSuppliers([...suppliers, { id, name }])
    setSupplier(id)
    toast.success(`Proveedor "${name}" creado`)
  }

  const handleBrandCreated = (id: string, name: string) => {
    setBrands([...brands, { id, name }])
    toast.success(`Marca "${name}" creada`)
  }

  const handleLineCreated = (id: string, name: string) => {
    setLines([...lines, { id, name }])
    // Auto-select the new line on the model that triggered the dialog
    if (selectedModelForDialog) {
      updateModel(selectedModelForDialog, 'lineId', id)
    }
    toast.success(`Línea "${name}" creada`)
  }

  const handleCategoryCreated = (id: string, name: string) => {
    loadCatalogs() // Reload to get updated categories
    toast.success(`Categoría "${name}" creada`)
  }

  const handleSizeCreated = (id: string, name: string) => {
    // Reload sizes for the current model's category
    const model = models.find(m => m.id === selectedModelForSize)
    if (model?.categoryId) {
      loadSizesForCategory(model.categoryId).then(() => {
        toast.success(`Talla(s) creada(s)`)
      })
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
    // MANTENER el mismo base_code para que se agrupe en el catálogo visual
    const baseCode = existingModel.baseCode

    const newModel: ProductModel = {
      id: crypto.randomUUID(),
      baseCode: baseCode, // MISMO código para agrupar todos los colores
      baseName: existingModel.baseName, // Mismo nombre base
      lineId: existingModel.lineId || '',
      categoryId: existingModel.categoryId || '',
      brandId: existingModel.brandId || '',
      color: '', // Vacío para que el usuario ingrese el nuevo color
      imageUrl: existingModel.imageUrl || '',
      purchasePrice: existingModel.purchasePrice || 0,
      salePrice: existingModel.salePrice || 0,
      variants: [],
      expanded: true
    }

    // Cargar tallas para la categoría
    if (newModel.categoryId) {
      await loadSizesForCategory(newModel.categoryId)
    }

    setModels([...models, newModel])
    setSearchQuery('')
    setSearchResults([])
    toast.success(`Modelo "${existingModel.baseName}" cargado con código ${baseCode}. Agrega el nuevo color.`)
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
    // Si cambia la categoría, cargar tallas ANTES de actualizar el estado
    if (field === 'categoryId' && value) {
      console.log('[updateModel] Category changed to:', value)
      
      // Cargar tallas y esperar a que termine
      await loadSizesForCategory(value)
      
      // Solo generar código si el modelo no tiene uno (es nuevo)
      const currentModel = models.find(m => m.id === id)
      if (!currentModel?.baseCode) {
        generateCodeForModel(id, value)
      }
      
      // Actualizar estado con nueva categoría, resetear variantes, mantener expanded
      setModels(models.map(m => 
        m.id === id 
          ? { ...m, categoryId: value, variants: [], expanded: true }
          : m
      ))
    } else {
      // Para otros campos, actualizar normalmente
      setModels(models.map(m => 
        m.id === id 
          ? { ...m, [field]: value }
          : m
      ))
    }
  }

  // Generar código automáticamente al seleccionar categoría
  const generateCodeForModel = async (modelId: string, categoryId: string) => {
    try {
      const response = await fetch(`/api/catalogs/next-code?category_id=${categoryId}`)
      const { data, error } = await response.json()

      if (error) {
        console.error('[generateCodeForModel] Error:', error)
        return
      }

      console.log('[generateCodeForModel] Generated code:', data.code)

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

  const toggleSize = (modelId: string, size: Size) => {
    setModels(models.map(m => {
      if (m.id === modelId) {
        const existingIndex = m.variants.findIndex(v => v.sizeId === size.id)
        
        if (existingIndex >= 0) {
          // Remover talla
          return {
            ...m,
            variants: m.variants.filter(v => v.sizeId !== size.id)
          }
        } else {
          // Agregar talla con color del modelo base
          return {
            ...m,
            variants: [
              ...m.variants,
              { 
                sizeId: size.id, 
                sizeName: size.name, 
                quantity: 0,
                color: m.color || '' // Heredar color del modelo
              }
            ]
          }
        }
      }
      return m
    }))
  }

  const updateVariantQuantity = (modelId: string, sizeId: string, quantity: number) => {
    setModels(models.map(m => {
      if (m.id === modelId) {
        return {
          ...m,
          variants: m.variants.map(v =>
            v.sizeId === sizeId ? { ...v, quantity } : v
          )
        }
      }
      return m
    }))
  }

  const updateVariantColor = (modelId: string, sizeId: string, color: string) => {
    setModels(models.map(m => {
      if (m.id === modelId) {
        return {
          ...m,
          variants: m.variants.map(v =>
            v.sizeId === sizeId ? { ...v, color } : v
          )
        }
      }
      return m
    }))
  }

  const toggleExpanded = (modelId: string) => {
    setModels(models.map(m =>
      m.id === modelId ? { ...m, expanded: !m.expanded } : m
    ))
  }

  const getTotalUnits = (model: ProductModel) => {
    return model.variants.reduce((sum, v) => sum + v.quantity, 0)
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

    setSaving(true)

    try {
      const productsToCreate = validModels.flatMap(model =>
        model.variants
          .filter(v => v.quantity > 0)
          .map(variant => ({
            barcode: `${model.baseCode}-${variant.sizeName}`,
            name: `${model.baseName} - ${variant.sizeName}`,
            base_code: model.baseCode,        // Clave de agrupación para Catálogo Visual
            base_name: model.baseName,        // Nombre del modelo sin sufijo de talla
            description: `${model.baseName} talla ${variant.sizeName}`,
            size: variant.sizeName,
            color: variant.color || model.color, // Usar color de variante o color base
            image_url: model.imageUrl || null, // Imagen del modelo (compartida)
            line_id: model.lineId,
            category_id: model.categoryId,
            brand_id: model.brandId,
            supplier_id: supplier,
            purchase_price: model.purchasePrice,
            price: model.salePrice,
            quantity: variant.quantity,
            warehouse_id: warehouse
          }))
      )

      const result = await createBulkProducts(productsToCreate)

      if (result.success) {
        toast.success(
          'Productos creados',
          `${result.data.count} productos registrados exitosamente`
        )
        
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
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
                <Select value={supplier} onValueChange={setSupplier} disabled={loading}>
                  <SelectTrigger className={`flex-1 ${!supplier ? 'border-red-300' : ''}`}>
                    <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar proveedor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tienda Mujeres">Tienda Mujeres</SelectItem>
                  <SelectItem value="Tienda Hombres">Tienda Hombres</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Search Existing Models */}
      {supplier && (
        <Card className="p-4 bg-blue-50 border-blue-200">
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
                    className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{model.baseName}</p>
                        <p className="text-xs text-gray-500">
                          Código: {model.baseCode} • {model.variants?.length || 0} variantes
                        </p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Cargar
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searching && (
              <div className="text-center text-sm text-gray-500">
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
              className="p-4 bg-gray-50 border-b flex items-center justify-between cursor-pointer"
              onClick={() => toggleExpanded(model.id)}
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="font-semibold">
                    Modelo {index + 1}
                    {model.baseName && `: ${model.baseName}`}
                  </h3>
                  {getTotalUnits(model) > 0 && (
                    <p className="text-xs text-gray-600">
                      {getTotalUnits(model)} unidades en {model.variants.length} tallas
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
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Model Content */}
            {model.expanded && (
              <div className="p-4 space-y-4">
                {/* Info banner - always show to explain base_code */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900 font-medium mb-1">
                    📦 Código Base: {model.baseCode || 'Se generará automáticamente'}
                  </p>
                  <p className="text-xs text-blue-700">
                    El <strong>código base</strong> agrupa todos los colores del mismo modelo en el catálogo visual. 
                    {model.baseCode 
                      ? ' Este modelo ya existe. Todos los colores que agregues se mostrarán juntos en la misma tarjeta.'
                      : ' Se generará automáticamente al seleccionar la categoría.'}
                  </p>
                </div>
                
                {/* Base Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">
                      Código Base <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Se genera automáticamente"
                      value={model.baseCode}
                      readOnly
                      disabled
                      className="flex-1 bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {model.baseCode 
                        ? 'Código del modelo (compartido por todos los colores)' 
                        : 'Se genera automáticamente al seleccionar categoría'}
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
                        onClick={() => { setSelectedModelForDialog(model.id); setShowLineDialog(true) }}
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
                        onClick={() => setShowCategoryDialog(true)}
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

                  <div>
                    <ColorPicker
                      label="Color Base"
                      value={model.color}
                      onChange={value => updateModel(model.id, 'color', value)}
                      placeholder="Selecciona o escribe un color"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                    <p className="text-xs text-gray-500 mt-1">
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
                        onClick={() => setShowBrandDialog(true)}
                        title="Crear marca"
                        disabled={loading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
                    <p className="text-xs text-gray-500">
                      Selecciona al menos una talla y asigna cantidades
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
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
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
                    </div>
                    {model.variants.length === 0 && (
                      <p className="text-xs text-red-500">
                        Debes seleccionar al menos una talla
                      </p>
                    )}
                  </div>
                )}

                {/* Variants Table */}
                {model.variants.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="text-sm font-semibold mb-3 block">
                      Variantes por Talla
                    </Label>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-3 font-semibold">Talla</th>
                            <th className="text-left p-3 font-semibold">Color</th>
                            <th className="text-center p-3 font-semibold">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.variants.map((variant, idx) => {
                            const hasCustomColor = variant.color && variant.color !== model.color
                            return (
                              <tr key={variant.sizeId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-3">
                                  <span className="font-semibold text-gray-700">
                                    {variant.sizeName}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <ColorPicker
                                        value={variant.color || model.color || ''}
                                        onChange={value =>
                                          updateVariantColor(
                                            model.id,
                                            variant.sizeId,
                                            value
                                          )
                                        }
                                        placeholder={model.color || 'Color'}
                                      />
                                    </div>
                                    {hasCustomColor && (
                                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                        Personalizado
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={variant.quantity || ''}
                                    onChange={e =>
                                      updateVariantQuantity(
                                        model.id,
                                        variant.sizeId,
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="text-center font-mono"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Tip: Puedes especificar un color diferente para cada talla. Si dejas vacío, usará el color base del modelo.
                    </p>
                  </div>
                )}

                {model.categoryId && categorySizes.length === 0 && (
                  <div className="border-t pt-4 text-center space-y-3">
                    <p className="text-sm text-gray-500">
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

      {/* Quick Create Dialogs */}
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
        lineId={models.find(m => m.id === selectedModelForDialog)?.lineId || models[0]?.lineId}
      />

      <QuickCreateDialog
        type="size"
        open={showSizeDialog}
        onOpenChange={setShowSizeDialog}
        onSuccess={handleSizeCreated}
        categoryId={models.find(m => m.id === selectedModelForSize)?.categoryId}
      />
    </div>
  )
}
