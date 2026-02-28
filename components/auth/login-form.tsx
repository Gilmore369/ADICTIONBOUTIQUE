'use client'

/**
 * Login Form Component
 * 
 * Client component for user authentication with email and password
 * 
 * Design Tokens Used:
 * - Spacing: 16px (card padding), 8px (gap)
 * - Border Radius: 8px (standard)
 * - Button: 36px height, 12px × 16px padding
 * - Typography: Body 14-16px
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await login(email, password)
      
      if (!result.success) {
        setError(result.error || 'Error al iniciar sesión')
        setLoading(false)
      }
      // If successful, the login action will redirect to dashboard
    } catch (err) {
      // Handle unexpected errors
      if (err instanceof Error && err.message !== 'NEXT_REDIRECT') {
        setError('Error inesperado. Por favor, intenta de nuevo.')
        setLoading(false)
      }
      // If it's a redirect error, let it propagate
      throw err
    }
  }

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
