/**
 * ProductForm Component
 * 
 * A form component for creating and editing products using React Hook Form + Zod validation.
 * Displays inline validation errors and handles all product attributes.
 * 
 * Features:
 * - React Hook Form integration with Zod schema validation
 * - Inline validation error display
 * - All product fields: barcode, name, description, line_id, category_id, brand_id, 
 *   supplier_id, size, color, presentation, purchase_price, price, min_stock, 
 *   entry_date, image_url, active
 * - Loading state during submission
 * - Success/error feedback
 * 
 * Design Tokens:
 * - Spacing: 16px (gap between form fields)
 * - Border radius: 8px (standard)
 * - Button height: 36px
 * 
 * Requirements: 14.6
 * Task: 8.8 Create product form component
 * 
 * @example
 * ```tsx
 * <ProductForm
 *   mode="create"
 *   onSuccess={(product) => console.log('Created:', product)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 * 
 * <ProductForm
 *   mode="edit"
 *   initialData={existingProduct}
 *   onSuccess={(product) => console.log('Updated:', product)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 * ```
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect, useRef, useMemo } from 'react'
import { productSchema } from '@/lib/validations/catalogs'
import { createProduct, updateProduct } from '@/actions/catalogs'
import { toast } from '@/lib/toast'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Upload, ImageIcon, X } from 'lucide-react'

// Type for form data based on productSchema
type ProductFormData = z.infer<typeof productSchema>

// Type for catalog options
interface CatalogOption {
  id: string
  name: string
}

interface ProductFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<ProductFormData> & { id?: string }
  onSuccess?: (product: any) => void
  onCancel?: () => void
}

export function ProductForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState<CatalogOption[]>([])
  const [categories, setCategories] = useState<CatalogOption[]>([])
  const [brands, setBrands] = useState<CatalogOption[]>([])
  const [suppliers, setSuppliers] = useState<CatalogOption[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>(initialData?.image_url || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize form with React Hook Form + Zod validation
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      barcode: initialData?.barcode || '',
      name: initialData?.name || '',
      description: initialData?.description || '',
      line_id: initialData?.line_id || '',
      category_id: initialData?.category_id || '',
      brand_id: initialData?.brand_id || '',
      supplier_id: initialData?.supplier_id || '',
      size: initialData?.size || '',
      color: initialData?.color || '',
      presentation: initialData?.presentation || '',
      purchase_price: initialData?.purchase_price || undefined,
      price: initialData?.price || undefined,
      min_stock: initialData?.min_stock ?? 1,
      entry_date: initialData?.entry_date || new Date().toISOString().split('T')[0],
      image_url: initialData?.image_url || '',
      active: initialData?.active ?? true,
    },
  })

  // Watch line_id to filter categories
  const watchedLineId = form.watch('line_id')
  const [allCategories, setAllCategories] = useState<CatalogOption[]>([])
  const filteredCategories = useMemo(() => {
    if (!watchedLineId || watchedLineId === 'none') return allCategories
    return (allCategories as any[]).filter((c: any) => !c.line_id || c.line_id === watchedLineId)
  }, [allCategories, watchedLineId])

  // Reset category when line changes
  useEffect(() => {
    if (watchedLineId) {
      form.setValue('category_id', '')
    }
  }, [watchedLineId])

  // Load catalog data (lines, categories, brands, suppliers)
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoadingCatalogs(true)
      try {
        // Fetch all catalogs in parallel
        const [linesRes, categoriesRes, brandsRes, suppliersRes] = await Promise.all([
          fetch('/api/catalogs/lines'),
          fetch('/api/catalogs/categories'),
          fetch('/api/catalogs/brands'),
          fetch('/api/catalogs/suppliers'),
        ])

        const [linesData, categoriesData, brandsData, suppliersData] = await Promise.all([
          linesRes.json(),
          categoriesRes.json(),
          brandsRes.json(),
          suppliersRes.json(),
        ])

        setLines(Array.isArray(linesData) ? linesData : (linesData.data || []))
        const cats = Array.isArray(categoriesData) ? categoriesData : (categoriesData.data || [])
        setAllCategories(cats)
        setCategories(cats)
        setBrands(Array.isArray(brandsData) ? brandsData : (brandsData.data || []))
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : (suppliersData.data || []))
      } catch (error) {
        console.error('Error loading catalogs:', error)
      } finally {
        setLoadingCatalogs(false)
      }
    }

    loadCatalogs()
  }, [])

  // Handle image file upload
  const handleImageUpload = async (file: File) => {
    if (!file) return
    const barcode = form.getValues('barcode')
    const baseCode = barcode || `temp-${Date.now()}`
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('base_code', baseCode)
      fd.append('is_primary', 'true')
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success && json.data?.public_url) {
        form.setValue('image_url', json.data.public_url)
        setImagePreview(json.data.public_url)
        toast.success('Imagen subida', 'La imagen del producto se subió correctamente')
      } else {
        toast.error('Error', json.error || 'No se pudo subir la imagen')
      }
    } catch {
      toast.error('Error', 'Error al subir la imagen')
    } finally {
      setUploadingImage(false)
    }
  }

  // Handle form submission
  const onSubmit = async (data: ProductFormData) => {
    setLoading(true)
    try {
      // Limpiar valores 'none' (sin selección) → vacío para no enviar IDs inválidos
      if (data.brand_id === 'none') data.brand_id = ''
      if (data.supplier_id === 'none') data.supplier_id = ''

      // Convert data to FormData for server action
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, String(value))
        }
      })

      const result = mode === 'create' 
        ? await createProduct(formData)
        : await updateProduct(initialData?.id!, formData)

      if (!result.success) {
        throw new Error(
          typeof result.error === 'string' 
            ? result.error 
            : 'Error saving product'
        )
      }

      onSuccess?.(result.data)
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error(
        'Error',
        error instanceof Error ? error.message : 'Error al guardar el producto'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Grid layout for form fields - 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Barcode */}
          <FormField
            control={form.control}
            name="barcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de Barras *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 7501234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del producto" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description - Full width */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descripción del producto" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Catalog selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Line */}
          <FormField
            control={form.control}
            name="line_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Línea *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loadingCatalogs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar línea" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loadingCatalogs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Brand */}
          <FormField
            control={form.control}
            name="brand_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loadingCatalogs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar marca" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin marca</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier */}
          <FormField
            control={form.control}
            name="supplier_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proveedor</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loadingCatalogs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Product attributes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Size */}
          <FormField
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Talla</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: M, 38, XL" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Color */}
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Rojo, Azul" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Presentation */}
          <FormField
            control={form.control}
            name="presentation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Presentación</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Caja, Unidad" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Pricing and stock */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Purchase Price */}
          <FormField
            control={form.control}
            name="purchase_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio de Compra</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sale Price */}
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio de Venta *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Min Stock */}
          <FormField
            control={form.control}
            name="min_stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Mínimo</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Additional fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Entry Date */}
          <FormField
            control={form.control}
            name="entry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Ingreso</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Image Upload */}
          <FormField
            control={form.control}
            name="image_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Foto del Producto</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-3">
                    {/* Preview */}
                    <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {imagePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage || loading}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingImage ? 'Subiendo…' : 'Adjuntar foto'}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP · Máx. 2 MB</p>
                      {imagePreview && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700"
                          onClick={() => { form.setValue('image_url', ''); setImagePreview('') }}
                        >
                          <X className="h-3 w-3" /> Quitar imagen
                        </button>
                      )}
                    </div>
                    {/* Hidden field value */}
                    <input type="hidden" {...field} value={field.value || ''} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Active checkbox */}
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </FormControl>
              <FormLabel className="!mt-0">Producto activo</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form actions - Button height: 36px per design tokens */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading || loadingCatalogs}>
            {loading ? 'Guardando...' : mode === 'create' ? 'Crear Producto' : 'Actualizar Producto'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
