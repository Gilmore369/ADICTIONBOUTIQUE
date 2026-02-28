# Toast Notification System - Usage Examples

This document provides examples of how to use the toast notification system in the application.

## Basic Usage

### Success Toast

```typescript
import { toast } from '@/lib/toast'

// Simple success message
toast.success('Producto creado')

// Success with description
toast.success('Producto creado', 'El producto se ha guardado correctamente en el catálogo')
```

### Error Toast

```typescript
import { toast } from '@/lib/toast'

// Simple error message
toast.error('Error al crear producto')

// Error with description
toast.error('Error al crear producto', 'El código de barras ya existe en el sistema')
```

### Info Toast

```typescript
import { toast } from '@/lib/toast'

toast.info('Información', 'Los cambios se guardarán automáticamente cada 30 segundos')
```

### Warning Toast

```typescript
import { toast } from '@/lib/toast'

toast.warning('Stock bajo', 'El producto tiene menos de 5 unidades disponibles')
```

## Advanced Usage

### Loading Toast

```typescript
import { toast } from '@/lib/toast'

// Show loading toast
const toastId = toast.loading('Guardando producto...')

// Later, dismiss it
toast.dismiss(toastId)
```

### Promise-based Toast

Automatically updates based on promise state:

```typescript
import { toast } from '@/lib/toast'

// With Server Action
toast.promise(
  createProduct(formData),
  {
    loading: 'Creando producto...',
    success: 'Producto creado exitosamente',
    error: 'Error al crear producto'
  }
)

// With dynamic messages
toast.promise(
  updateProduct(id, data),
  {
    loading: 'Actualizando producto...',
    success: (data) => `Producto ${data.name} actualizado`,
    error: (error) => `Error: ${error.message}`
  }
)
```

## Real-World Examples

### Form Submission

```typescript
'use client'

import { toast } from '@/lib/toast'
import { createProduct } from '@/actions/products'

export function ProductForm() {
  async function handleSubmit(formData: FormData) {
    const result = await createProduct(formData)
    
    if (result.success) {
      toast.success('Producto creado', 'El producto se ha guardado correctamente')
    } else {
      toast.error('Error al crear producto', result.error)
    }
  }
  
  return (
    <form action={handleSubmit}>
      {/* form fields */}
    </form>
  )
}
```

### With Promise Pattern

```typescript
'use client'

import { toast } from '@/lib/toast'
import { deleteProduct } from '@/actions/products'

export function DeleteButton({ productId }: { productId: string }) {
  async function handleDelete() {
    toast.promise(
      deleteProduct(productId),
      {
        loading: 'Eliminando producto...',
        success: 'Producto eliminado exitosamente',
        error: 'No se pudo eliminar el producto'
      }
    )
  }
  
  return (
    <button onClick={handleDelete}>
      Eliminar
    </button>
  )
}
```

### Sale Creation (POS Module)

```typescript
'use client'

import { toast } from '@/lib/toast'
import { createSale } from '@/actions/sales'

export function CompleteSaleButton({ cart, clientId }: Props) {
  async function handleCompleteSale() {
    const toastId = toast.loading('Procesando venta...')
    
    try {
      const result = await createSale({
        items: cart,
        client_id: clientId,
        sale_type: 'CREDITO'
      })
      
      toast.dismiss(toastId)
      
      if (result.success) {
        toast.success('Venta completada', `Venta ${result.data.sale_number} registrada`)
      } else {
        toast.error('Error al procesar venta', result.error)
      }
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('Error inesperado', 'Por favor intente nuevamente')
    }
  }
  
  return (
    <button onClick={handleCompleteSale}>
      Completar Venta
    </button>
  )
}
```

### Payment Processing (Collections Module)

```typescript
'use client'

import { toast } from '@/lib/toast'
import { processPayment } from '@/actions/payments'

export function PaymentForm({ clientId }: { clientId: string }) {
  async function handleSubmit(formData: FormData) {
    const amount = Number(formData.get('amount'))
    
    toast.promise(
      processPayment(clientId, amount),
      {
        loading: 'Procesando pago...',
        success: (result) => {
          return `Pago registrado: S/ ${amount.toFixed(2)} aplicado a ${result.installments_updated} cuotas`
        },
        error: (error) => `Error al procesar pago: ${error.message}`
      }
    )
  }
  
  return (
    <form action={handleSubmit}>
      {/* form fields */}
    </form>
  )
}
```

## Configuration

The toast system is already configured in `app/layout.tsx` with the `<Toaster />` component from sonner.

### Default Durations

- Success: 4000ms (4 seconds)
- Error: 5000ms (5 seconds)
- Info: 4000ms (4 seconds)
- Warning: 4500ms (4.5 seconds)
- Loading: Until dismissed

### Custom Icons

The toaster is configured with custom Lucide icons:
- Success: CircleCheckIcon
- Error: OctagonXIcon
- Warning: TriangleAlertIcon
- Info: InfoIcon
- Loading: Loader2Icon (animated)

## Best Practices

1. **Use descriptive messages**: Make messages clear and actionable
2. **Provide context in descriptions**: Add details that help users understand what happened
3. **Use promise pattern for async operations**: Automatically handles loading, success, and error states
4. **Dismiss loading toasts**: Always dismiss loading toasts when operation completes
5. **Keep messages concise**: Users should be able to read the message quickly
6. **Use appropriate toast types**: Match the toast type to the message severity

## Requirements Validation

This implementation satisfies:
- **Requirement 14.5**: Toast notifications for error messages
- **Requirement 15.1**: User-friendly error messages
- **Requirement 15.2**: Validation error display
- **Requirement 15.3**: Network error handling with retry option
