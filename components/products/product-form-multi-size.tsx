/**
 * ProductFormMultiSize Component
 * 
 * Form for creating multiple product variants (sizes) at once.
 * Similar to bulk entry but simplified for single model with multiple sizes.
 * 
 * Features:
 * - Create base product information once
 * - Select multiple sizes
 * - Assign quantity and optional custom color per size
 * - Generates barcode automatically: {baseCode}-{size}
 * - Creates all variants in one transaction
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createBulkProducts } from '@/actions/products'
import { ColorPicker } from '@/components/ui/color-picker'
import { ImageUpload } from '@/components/ui/image-upload'

interface Size {
  id: string
  name: string
}

interface SizeVariant {
  sizeId: string
  sizeName: string
  quantity: number
  color?: string
}

interface ProductFormMultiSizeProps {
  onSuccess?: (result: any) => void
  onCancel?: () => void
}

export function ProductFormMultiSize({ onSuccess, onCancel }: ProductFormMultiSizeProps) {
  // Base product fields
  const [baseCode, setBaseCode] = useState('')
  const [baseName, setBaseName] = useState('')
  const [description, setDescription] = useState('')
  const [lineId, setLineId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [color, setColor] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [salePrice, setSalePrice] = useState(0)
  const [warehouse, setWarehouse] = useState('Tienda Mujeres')
  
  // Size variants
  const [variants, setVariants] = useState<SizeVariant[]>([])
  
  // Catalog data
  const [lines, setLines] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [availableSizes, setAvailableSizes] = useState<Size[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCatalogs()
  }, [])

  const loadCatalogs = async () => {
    try {
      const [linesRes, categoriesRes, brandsRes, suppliersRes] = await Promise.all([
        fetch('/api/catalogs/lines'),
        fetch('/api/catalogs/categories'),
        fetch('/api/catalogs/brands'),
        fetch('/api/catalogs/suppliers')
      ])

      const [linesData, categoriesData, brandsData, suppliersData] = await Promise.all([
        linesRes.json(),
        categoriesRes.json(),
        brandsRes.json(),
        suppliersRes.json()
      ])

      setLines(linesData.data || [])
      setCategories(categoriesData.data || [])
      setBrands(brandsData.data || [])
      setSuppliers(suppliersData.data || [])
    } catch (error) {
      console.error('Error loading catalogs:', error)
      toast.error('Error al cargar catálogos')
    } finally {
      setLoading(false)
    }
  }

  const loadSizesForCategory = async (catId: string) => {
    try {
      const response = await fetch(`/api/catalogs/sizes?category_id=${catId}`)
      const { data } = await response.json()
      setAvailableSizes(data || [])
    } catch (error) {
      console.error('Error loading sizes:', error)
      setAvailableSizes([])
    }
  }

  const handleCategoryChange = async (catId: string) => {
    setCategoryId(catId)
    setVariants([]) // Reset variants when category changes
    
    if (catId) {
      await loadSizesForCategory(catId)
      // Generate code automatically
      try {
        const response = await fetch(`/api/catalogs/next-code?category_id=${catId}`)
        const { data } = await response.json()
        if (data?.code) {
          setBaseCode(data.code)
        }
      } catch (error) {
        console.error('Error generating code:', error)
      }
    } else {
      setAvailableSizes([])
      setBaseCode('')
    }
  }

  const toggleSize = (size: Size) => {
    const existingIndex = variants.findIndex(v => v.sizeId === size.id)
    
    if (existingIndex >= 0) {
      // Remove size
      setVariants(variants.filter(v => v.sizeId !== size.id))
    } else {
      // Add size with base color
      setVariants([
        ...variants,
        { 
          sizeId: size.id, 
          sizeName: size.name, 
          quantity: 0,
          color: color || ''
        }
      ])
    }
  }

  const updateVariantQuantity = (sizeId: string, quantity: number) => {
    setVariants(variants.map(v =>
      v.sizeId === sizeId ? { ...v, quantity } : v
    ))
  }

  const updateVariantColor = (sizeId: string, newColor: string) => {
    setVariants(variants.map(v =>
      v.sizeId === sizeId ? { ...v, color: newColor } : v
    ))
  }

  const getTotalUnits = () => {
    return variants.reduce((sum, v) => sum + v.quantity, 0)
  }

  const handleSubmit = async () => {
    // Validation
    if (!baseCode || !baseName || !categoryId || !brandId) {
      toast.error('Completa todos los campos requeridos', 
        'Código, Nombre, Categoría y Marca son obligatorios')
      return
    }

    if (variants.length === 0 || getTotalUnits() === 0) {
      toast.error('Selecciona al menos una talla con cantidad')
      return
    }

    if (!salePrice || salePrice <= 0) {
      toast.error('El precio de venta debe ser mayor a 0')
      return
    }

    setSaving(true)

    try {
      const productsToCreate = variants
        .filter(v => v.quantity > 0)
        .map(variant => ({
          barcode: `${baseCode}-${variant.sizeName}`,
          name: `${baseName} - ${variant.sizeName}`,
          description: description || `${baseName} talla ${variant.sizeName}`,
          size: variant.sizeName,
          color: variant.color || color,
          image_url: imageUrl || null,
          line_id: lineId,
          category_id: categoryId,
          brand_id: brandId,
          supplier_id: supplierId || null,
          purchase_price: purchasePrice,
          price: salePrice,
          quantity: variant.quantity,
          warehouse_id: warehouse
        }))

      const result = await createBulkProducts(productsToCreate)

      if (result.success) {
        toast.success(
          'Productos creados',
          `${result.data.count} productos registrados exitosamente`
        )
        onSuccess?.(result.data)
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

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
      {/* Base Product Info */}
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900 font-medium">
            📦 Crear Producto con Múltiples Tallas
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Define la información base del producto y selecciona las tallas que deseas crear
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">
              Código Base <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Se genera automáticamente"
              value={baseCode}
              readOnly
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se genera al seleccionar categoría
            </p>
          </div>

          <div>
            <Label className="text-xs">
              Nombre Base <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Ej: Blusa Casual"
              value={baseName}
              onChange={e => setBaseName(e.target.value)}
              className={!baseName ? 'border-red-300' : ''}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Descripción</Label>
          <Textarea
            placeholder="Descripción del producto (opcional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Línea</Label>
            <Select value={lineId} onValueChange={setLineId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar"} />
              </SelectTrigger>
              <SelectContent>
                {lines.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              Categoría <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={categoryId} 
              onValueChange={handleCategoryChange} 
              disabled={loading}
            >
              <SelectTrigger className={!categoryId ? 'border-red-300' : ''}>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar"} />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter(c => !lineId || c.line_id === lineId)
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              Marca <span className="text-red-500">*</span>
            </Label>
            <Select value={brandId} onValueChange={setBrandId} disabled={loading}>
              <SelectTrigger className={!brandId ? 'border-red-300' : ''}>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar"} />
              </SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Proveedor</Label>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <ColorPicker
              label="Color Base"
              value={color}
              onChange={setColor}
              placeholder="Selecciona o escribe un color"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se aplica a todas las tallas (puedes personalizar después)
            </p>
          </div>

          <div>
            <ImageUpload
              label="Imagen (opcional)"
              value={imageUrl}
              onChange={setImageUrl}
              onRemove={() => setImageUrl('')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Precio Compra</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={purchasePrice || ''}
              onChange={e => setPurchasePrice(Number(e.target.value))}
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
              value={salePrice || ''}
              onChange={e => setSalePrice(Number(e.target.value))}
              className={!salePrice || salePrice <= 0 ? 'border-red-300' : ''}
            />
          </div>

          <div>
            <Label className="text-xs">
              Tienda <span className="text-red-500">*</span>
            </Label>
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

      {/* Size Selection */}
      {categoryId && availableSizes.length > 0 && (
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">
            Seleccionar Tallas <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-gray-500">
            Selecciona las tallas y asigna cantidades
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map(size => {
              const isSelected = variants.some(v => v.sizeId === size.id)
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
                    onCheckedChange={() => toggleSize(size)}
                  />
                  <span className="text-sm font-medium">{size.name}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Variants Table */}
      {variants.length > 0 && (
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
                {variants.map((variant, idx) => {
                  const hasCustomColor = variant.color && variant.color !== color
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
                              value={variant.color || color || ''}
                              onChange={value => updateVariantColor(variant.sizeId, value)}
                              placeholder={color || 'Color'}
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
                          onChange={e => updateVariantQuantity(variant.sizeId, Number(e.target.value) || 0)}
                          className="text-center font-mono"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-right">
            <Badge variant="secondary" className="text-sm">
              Total: {getTotalUnits()} unidades
            </Badge>
          </div>
        </div>
      )}

      {/* No sizes message */}
      {categoryId && availableSizes.length === 0 && (
        <div className="border-t pt-4 text-center text-gray-500">
          <p className="text-sm">Esta categoría no tiene tallas configuradas</p>
          <p className="text-xs mt-1">Crea tallas en el módulo de Catálogos → Tallas</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </Button>
        )}
        <Button 
          onClick={handleSubmit} 
          disabled={saving || variants.length === 0 || getTotalUnits() === 0}
        >
          {saving ? 'Guardando...' : `Crear ${getTotalUnits()} Productos`}
        </Button>
      </div>
    </div>
  )
}
