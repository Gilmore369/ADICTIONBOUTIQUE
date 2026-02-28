'use client'

/**
 * Toast Demo Component
 * 
 * Demonstrates the usage of the toast notification system.
 * This component can be used for testing and as a reference.
 */

import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <Button
        onClick={() => toast.success('Operación exitosa', 'Los datos se guardaron correctamente')}
        variant="default"
      >
        Success Toast
      </Button>

      <Button
        onClick={() => toast.error('Error al guardar', 'El código de barras ya existe')}
        variant="destructive"
      >
        Error Toast
      </Button>

      <Button
        onClick={() => toast.info('Información', 'Los cambios se guardarán automáticamente')}
        variant="secondary"
      >
        Info Toast
      </Button>

      <Button
        onClick={() => toast.warning('Advertencia', 'El stock está bajo')}
        variant="outline"
      >
        Warning Toast
      </Button>

      <Button
        onClick={() => {
          const id = toast.loading('Cargando datos...')
          setTimeout(() => toast.dismiss(id), 2000)
        }}
        variant="outline"
      >
        Loading Toast
      </Button>

      <Button
        onClick={() => {
          const mockPromise = new Promise((resolve) => 
            setTimeout(() => resolve({ name: 'Producto Test' }), 2000)
          )
          
          toast.promise(mockPromise, {
            loading: 'Guardando producto...',
            success: 'Producto guardado exitosamente',
            error: 'Error al guardar producto'
          })
        }}
        variant="outline"
      >
        Promise Toast
      </Button>
    </div>
  )
}
