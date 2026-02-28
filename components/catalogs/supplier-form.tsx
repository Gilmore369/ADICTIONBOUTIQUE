'use client'

/**
 * Supplier Form Component
 * 
 * Form for creating/editing suppliers
 * Includes contact information fields
 */

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface SupplierFormProps {
  defaultValues?: {
    name?: string
    contact_name?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
  }
}

export function SupplierForm({ defaultValues }: SupplierFormProps) {
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
          placeholder="Nombre del proveedor"
          required
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact_name">Contacto</Label>
        <Input
          id="contact_name"
          name="contact_name"
          defaultValue={defaultValues?.contact_name}
          placeholder="Nombre del contacto"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultValues?.phone}
            placeholder="Teléfono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email}
            placeholder="email@ejemplo.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          name="address"
          defaultValue={defaultValues?.address}
          placeholder="Dirección completa"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Input
          id="notes"
          name="notes"
          defaultValue={defaultValues?.notes}
          placeholder="Notas adicionales"
        />
      </div>
    </div>
  )
}
