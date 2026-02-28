/**
 * Toast notification utilities using sonner
 * 
 * Provides convenient wrapper functions for displaying toast notifications
 * throughout the application with consistent styling and behavior.
 * 
 * @module lib/toast
 */

import { toast as sonnerToast } from 'sonner'

/**
 * Display a success toast notification
 * 
 * @param message - The success message to display
 * @param description - Optional additional description
 * 
 * @example
 * ```ts
 * toast.success('Producto creado', 'El producto se ha guardado correctamente')
 * ```
 */
export function success(message: string, description?: string) {
  return sonnerToast.success(message, {
    description,
    duration: 4000,
  })
}

/**
 * Display an error toast notification
 * 
 * @param message - The error message to display
 * @param description - Optional additional description or error details
 * 
 * @example
 * ```ts
 * toast.error('Error al crear producto', 'El código de barras ya existe')
 * ```
 */
export function error(message: string, description?: string) {
  return sonnerToast.error(message, {
    description,
    duration: 5000,
  })
}

/**
 * Display an info toast notification
 * 
 * @param message - The info message to display
 * @param description - Optional additional description
 * 
 * @example
 * ```ts
 * toast.info('Información', 'Los cambios se guardarán automáticamente')
 * ```
 */
export function info(message: string, description?: string) {
  return sonnerToast.info(message, {
    description,
    duration: 4000,
  })
}

/**
 * Display a warning toast notification
 * 
 * @param message - The warning message to display
 * @param description - Optional additional description
 * 
 * @example
 * ```ts
 * toast.warning('Stock bajo', 'El producto tiene menos de 5 unidades')
 * ```
 */
export function warning(message: string, description?: string) {
  return sonnerToast.warning(message, {
    description,
    duration: 4500,
  })
}

/**
 * Display a loading toast notification
 * 
 * @param message - The loading message to display
 * @returns Toast ID that can be used to dismiss or update the toast
 * 
 * @example
 * ```ts
 * const toastId = toast.loading('Guardando producto...')
 * // Later dismiss it
 * toast.dismiss(toastId)
 * ```
 */
export function loading(message: string) {
  return sonnerToast.loading(message)
}

/**
 * Display a promise-based toast that automatically updates based on promise state
 * 
 * @param promise - The promise to track
 * @param messages - Messages for loading, success, and error states
 * 
 * @example
 * ```ts
 * toast.promise(
 *   createProduct(data),
 *   {
 *     loading: 'Creando producto...',
 *     success: 'Producto creado exitosamente',
 *     error: 'Error al crear producto'
 *   }
 * )
 * ```
 */
export function promise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: Error) => string)
  }
) {
  return sonnerToast.promise(promise, messages)
}

/**
 * Dismiss a specific toast by ID or all toasts
 * 
 * @param toastId - Optional toast ID to dismiss. If not provided, dismisses all toasts
 * 
 * @example
 * ```ts
 * const id = toast.loading('Cargando...')
 * // Later
 * toast.dismiss(id)
 * ```
 */
export function dismiss(toastId?: string | number) {
  return sonnerToast.dismiss(toastId)
}

/**
 * Toast utility object with all notification methods
 * 
 * @example
 * ```ts
 * import { toast } from '@/lib/toast'
 * 
 * toast.success('Operación exitosa')
 * toast.error('Algo salió mal')
 * toast.info('Información importante')
 * toast.warning('Advertencia')
 * ```
 */
export const toast = {
  success,
  error,
  info,
  warning,
  loading,
  promise,
  dismiss,
}
