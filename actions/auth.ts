/**
 * Authentication Server Actions
 * 
 * Server actions for user authentication (login, logout, etc.)
 */

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Login validation schema
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type LoginResult = {
  success: boolean
  error?: string
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  // Validate input
  const validated = loginSchema.safeParse({ email, password })
  
  if (!validated.success) {
    const errors = validated.error.flatten().fieldErrors
    const firstError = errors.email?.[0] || errors.password?.[0]
    return { success: false, error: firstError }
  }

  try {
    const supabase = await createServerClient()
    
    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.data.email,
      password: validated.data.password,
    })

    if (error) {
      // Handle specific error cases
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Email o contraseña incorrectos' }
      }
      return { success: false, error: error.message }
    }

    if (!data.session) {
      return { success: false, error: 'No se pudo crear la sesión' }
    }

    // Revalidate and redirect
    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (error) {
    // Handle redirect errors (thrown by Next.js redirect)
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    
    return {
      success: false,
      error: 'Error al iniciar sesión. Por favor, intenta de nuevo.',
    }
  }
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
