'use client'

/**
 * EditClientDialog
 * 
 * Dialog for editing existing client information
 * Uses the ClientForm component in edit mode
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ClientForm } from './client-form'

interface EditClientDialogProps {
  client: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const handleSuccess = () => {
    onOpenChange(false)
    // Reload the page to show updated data
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <ClientForm
          mode="edit"
          initialData={{
            id: client.id,
            dni: client.dni,
            name: client.name,
            phone: client.phone,
            email: client.email,
            address: client.address,
            lat: client.lat,
            lng: client.lng,
            credit_limit: client.credit_limit,
            credit_used: client.credit_used,
            dni_photo_url: client.dni_photo_url,
            client_photo_url: client.client_photo_url,
            birthday: client.birthday,
            active: client.active,
          }}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
