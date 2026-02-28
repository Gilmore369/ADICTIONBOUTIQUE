'use client'

/**
 * Bulk Product Entry Component
 * 
 * Ingreso masivo de productos por modelo base + distribución de tallas
 * Flujo: Seleccionar categoría → Ver tallas disponibles → Ingresar cantidades por talla
 * 
 * Design Tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Button height: 36px
 * - Spacing: 16px, 24px
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Save, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { createBulkProducts } from '@/actions/products'

interface Size {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
}

interface Line {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
  line_id: string
}

interface Brand {
  id: string
  name: string
}

interface ProductModel {
  id: string
  baseCode: string
  baseName: string
  categoryId: string
  lineId: string
  brandId: string
  supplierId: string
  color: string
  purchasePrice: number
  salePrice: number
  sizes: { [sizeId: string]: number } // sizeId -> quantity
}

export function BulkProductEntry() {
  const [supplier, setSupplier] = useState('')
  const [warehouse, setWarehouse] = useState('Tienda Mujeres')
  const [models, setModels] = useState<ProductModel[]>([])
  const [availableSizes, setAvailableSizes] = useState<Size[]>([])
  const [saving, setSaving] = useState(false)
  
  // Catalog data
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  // Load catalog data on mount
  useEffect(() => {
    loadCatalogs()
  }, [])

  const loadCatalogs = async () => {
    try {
      const [suppliersRes, linesRes, categoriesRes, brandsRes] = await Promise.all([
        fetch('/api/catalogs/suppliers'),
        fetch('/api/catalogs/lines'),
        fetch('/api/catalogs/categories'),
        fetch('/api/catalogs/brands')
      ])

      const [suppliersData, linesData, categoriesData, brandsData] = await Promise.all([
        suppliersRes.json(),
        linesRes.json(),
        categoriesRes.json(),
        brandsRes.json()
      ])

      setSuppliers(suppliersData.data || [])
      setLines(linesData.data || [])
      setCategories(categoriesData.data || [])
      setBrands(brandsData.data || [])
    } catch (error) {
      console.error('Error loading catalogs:', error)
      toast.error('Error al cargar catálogos')
    } finally {
      setLoading(false)
    }
  }

  const addModel = () => {
    setModels([
      ...models,
      {
        id: crypto.randomUUID(),
        baseCode: '',
        baseName: '',
        categoryId: '',
        lineId: '',
        brandId: '',
        supplierId: supplier,
        color: '',
        purchasePrice: 0,
        salePrice: 0,
        sizes: {},
      },
    ])
  }

  const removeModel = (id: string) => {
    setModels(models.filter((m) => m.id !== id))
  }

  const updateModel = (id: string, field: keyof ProductModel, value: any) => {
    setModels(
      models.map((m) => {
        if (m.id === id) {
          const updated = { ...m, [field]: value }
          
          // Si cambia la categoría, resetear tallas y cargar nuevas
          if (field === 'categoryId') {
            updated.sizes = {}
            loadSizesForCategory(value)
          }
          
          return updated
        }
        return m
      })
    )
  }

  const updateSizeQuantity = (modelId: string, sizeId: string, quantity: number) => {
    setModels(
      models.map((m) => {
        if (m.id === modelId) {
          return {
            ...m,
            sizes: {
              ...m.sizes,
              [sizeId]: quantity,
            },
          }
        }
        return m
      })
    )
  }

  const loadSizesForCategory = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/catalogs/sizes?category_id=${categoryId}`)
      const { data } = await response.json()
      
      if (data && data.length > 0) {
        setAvailableSizes(data)
      } else {
        setAvailableSizes([])
      }
    } catch (error) {
      console.error('Error loading sizes:', error)
      setAvailableSizes([])
    }
  }

  const getTotalUnits = (model: ProductModel) => {
    return Object.values(model.sizes).reduce((sum, qty) => sum + qty, 0)
  }

  const handleSave = async () => {
    // Validar
    if (!supplier) {
      toast.error('Selecciona un proveedor')
      return
    }

    const validModels = models.filter(
      (m) => m.baseCode && m.baseName && getTotalUnits(m) > 0
    )

    if (validModels.length === 0) {
      toast.error('Agrega al menos un modelo con tallas')
      return
    }

    setSaving(true)

    try {
      // Generar productos individuales por talla
      const productsToCreate = validModels.flatMap((model) => {
        return Object.entries(model.sizes)
          .filter(([_, qty]) => qty > 0)
          .map(([sizeId, quantity]) => {
            const sizeName = availableSizes.find((s) => s.id === sizeId)?.name || sizeId
            return {
              barcode: `${model.baseCode}-${sizeName}`,
              name: `${model.baseName} - ${sizeName}`,
              description: `${model.baseName} talla ${sizeName}`,
              size: sizeName,
              color: model.color,
              line_id: model.lineId,
              category_id: model.categoryId,
              brand_id: model.brandId,
              supplier_id: model.supplierId,
              purchase_price: model.purchasePrice,
              price: model.salePrice,
              quantity: quantity,
              warehouse_id: warehouse,
            }
          })
      })

      // Llamar Server Action
      const result = await createBulkProducts(productsToCreate)

      if (result.success) {
        toast.success(
          'Productos creados',
          `${result.data.count} productos registrados exitosamente`
        )
        
        // Limpiar formulario
        setModels([])
        setSupplier('')
        setAvailableSizes([])
        
        // Agregar primer modelo vacío
        addModel()
      } else {
        toast.error(
          'Error al crear productos',
          typeof result.error === 'string' ? result.error : 'Error desconocido'
        )
      }
    } catch (error) {
      console.error('Error saving products:', error)
      toast.error(
        'Error inesperado',
        error instanceof Error ? error.message : 'Error al guardar productos'
      )
    } finally {
      setSaving(false)
    }
  }

  // Agregar primer modelo al iniciar
  useEffect(() => {
    if (models.length === 0) {
      addModel()
    }
  }, [])

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="p-4">
          <p className="text-sm text-gray-500">Cargando catálogos...</p>
        </Card>
      ) : (
        <>
          {/* Header */}
          <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Proveedor *</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tienda Destino *</Label>
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
      </Card>

      {/* Models */}
      {models.map((model, index) => (
        <Card key={model.id} className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-500" />
              <h3 className="font-semibold">Modelo {index + 1}</h3>
              {getTotalUnits(model) > 0 && (
                <Badge variant="secondary">
                  {getTotalUnits(model)} unidades
                </Badge>
              )}
            </div>
            {models.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeModel(model.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Datos del modelo base */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs">Código Base *</Label>
              <Input
                placeholder="Ej: BLS-001"
                value={model.baseCode}
                onChange={(e) =>
                  updateModel(model.id, 'baseCode', e.target.value)
                }
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs">Nombre Base *</Label>
              <Input
                placeholder="Ej: Blusa Casual Verano"
                value={model.baseName}
                onChange={(e) =>
                  updateModel(model.id, 'baseName', e.target.value)
                }
              />
            </div>

            <div>
              <Label className="text-xs">Línea</Label>
              <Select
                value={model.lineId}
                onValueChange={(value) =>
                  updateModel(model.id, 'lineId', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Categoría *</Label>
              <Select
                value={model.categoryId}
                onValueChange={(value) =>
                  updateModel(model.id, 'categoryId', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => !model.lineId || c.line_id === model.lineId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Color</Label>
              <Input
                placeholder="Ej: Azul"
                value={model.color}
                onChange={(e) =>
                  updateModel(model.id, 'color', e.target.value)
                }
              />
            </div>

            <div>
              <Label className="text-xs">Marca</Label>
              <Select
                value={model.brandId}
                onValueChange={(value) =>
                  updateModel(model.id, 'brandId', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Precio Compra *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={model.purchasePrice || ''}
                onChange={(e) =>
                  updateModel(model.id, 'purchasePrice', Number(e.target.value))
                }
              />
            </div>

            <div>
              <Label className="text-xs">Precio Venta *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={model.salePrice || ''}
                onChange={(e) =>
                  updateModel(model.id, 'salePrice', Number(e.target.value))
                }
              />
            </div>
          </div>

          {/* Grid de tallas */}
          {model.categoryId && availableSizes.length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold mb-3 block">
                Distribución por Tallas
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {availableSizes.map((size) => (
                  <div key={size.id} className="space-y-1">
                    <Label className="text-xs text-gray-600">{size.name}</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={model.sizes[size.id] || ''}
                      onChange={(e) =>
                        updateSizeQuantity(
                          model.id,
                          size.id,
                          Number(e.target.value) || 0
                        )
                      }
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {model.categoryId && availableSizes.length === 0 && (
            <div className="border-t pt-4 text-center text-sm text-gray-500">
              Esta categoría no tiene tallas configuradas
            </div>
          )}
        </Card>
      ))}

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
        </>
      )}
    </div>
  )
}
