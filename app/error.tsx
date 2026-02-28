'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console for development
    console.error('Application error:', error)
    
    // Log error to audit_log table
    logErrorToAudit(error).catch(err => {
      console.error('Failed to log error to audit:', err)
    })
  }, [error])
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Algo salió mal
        </h2>
        <p className="text-gray-600">
          Lo sentimos, ocurrió un error inesperado. Por favor, intenta nuevamente.
        </p>
        {error.digest && (
          <p className="text-sm text-gray-500">
            ID de error: {error.digest}
          </p>
        )}
        <Button 
          onClick={reset}
          className="w-full"
        >
          Intentar nuevamente
        </Button>
      </div>
    </div>
  )
}

/**
 * Logs error to audit_log table
 * Requirements: 15.4, 15.5
 */
async function logErrorToAudit(error: Error & { digest?: string }) {
  try {
    const errorData = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString()
    }
    
    // Call API route to log error (server-side to access Supabase)
    await fetch('/api/audit/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorData)
    })
  } catch (err) {
    // Silently fail - don't throw errors in error handler
    console.error('Error logging failed:', err)
  }
}
