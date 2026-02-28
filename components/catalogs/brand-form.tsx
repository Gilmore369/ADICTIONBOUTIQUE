'use client'

/**
 * Brand Form Component
 * 
 * Form for creating/editing brands with supplier relationships
 */

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

interface Supplier {
  id: string
  name: string
}

interface BrandFormProps {
  suppliers: Supplier[]
  defaultValues?: {
    name?: string
    description?: string
    supplier_brands?: Array<{
      supplier_id: string
      suppliers: { id: string; name: string } | null
    }>
  }
}

export function BrandForm({ suppliers, defaultValues }: BrandFormProps) {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(
    defaultValues?.supplier_brands?.map(sb => sb.supplier_id) || []
  )

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          placeholder="Ej: Nike, Adidas"
          required
          maxLength={100}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          placeholder="Descripción opcional"
        />
      </div>

      <div className="space-y-2">
        <Label>
          Proveedores <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-gray-500">
          Selecciona uno o más proveedores que venden esta marca
        </p>
        <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
          {suppliers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">
              No hay proveedores disponibles
            </p>
          ) : (
            suppliers.map(supplier => (
              <label
                key={supplier.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <Checkbox
                  checked={selectedSuppliers.includes(supplier.id)}
                  onCheckedChange={() => toggleSupplier(supplier.id)}
                />
                <span className="text-sm">{supplier.name}</span>
                <input
                  type="hidden"
                  name="supplier_ids"
                  value={selectedSuppliers.includes(supplier.id) ? supplier.id : ''}
                />
              </label>
            ))
          )}
        </div>
        {selectedSuppliers.length === 0 && (
          <p className="text-xs text-red-500">
            Debes seleccionar al menos un proveedor
          </p>
        )}
      </div>

      {/* Hidden inputs for selected suppliers */}
      {selectedSuppliers.map(supplierId => (
        <input
          key={supplierId}
          type="hidden"
          name="supplier_ids[]"
          value={supplierId}
        />
      ))}
    </div>
  )
}
