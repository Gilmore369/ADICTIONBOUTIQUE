/**
 * Login Page
 * 
 * Public page for user authentication with email and password
 */

import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="w-full max-w-md space-y-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Adiction Boutique Suite
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Ingresa tus credenciales para acceder
        </p>
      </div>
      
      <LoginForm />
    </div>
  )
}
