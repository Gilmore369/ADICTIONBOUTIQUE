'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { calculateClientRating } from '@/lib/services/rating-service'

/**
 * Server Actions for Client Rating Operations
 * 
 * Requirements: 2.1, 2.11
 * Task: 21.2 Create rating actions
 */

/**
 * Calculate and Update Client Rating
 * 
 * Calculates the rating for a client and updates the clients table.
 */
export async function calculateAndUpdateRating(clientId: string) {
  try {
    const supabase = await createServerClient()
    
    // Check authorization
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('No autenticado')
    }

    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()

    if (!profile || (!((profile as any).roles?.includes('admin')) && !((profile as any).roles?.includes('vendedor')))) {
      throw new Error('No tiene permisos para realizar esta acción')
    }

    // Calculate rating
    const rating = await calculateClientRating(clientId)
    
    // Update clients table with rating
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        rating: rating.rating,
        rating_score: rating.score,
      })
      .eq('id', clientId)
    
    if (updateError) {
      throw new Error(`Error updating client rating: ${updateError.message}`)
    }
    
    // Revalidate paths
    revalidatePath(`/clients/${clientId}`)
    revalidatePath('/clients')
    revalidatePath('/clients/dashboard')
    
    return { success: true, rating }
  } catch (error) {
    console.error('Error calculating and updating rating:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al calcular la calificación'
    }
  }
}

/**
 * Recalculate All Client Ratings
 * 
 * Recalculates ratings for all active clients. Admin only.
 */
export async function recalculateAllRatings() {
  try {
    const supabase = await createServerClient()
    
    // Check authorization (admin only)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('No autenticado')
    }

    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()

    if (!profile || !(profile as any).roles?.includes('admin')) {
      throw new Error('Se requieren permisos de administrador')
    }

    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('active', true)
    
    if (clientsError) {
      throw new Error(`Error fetching clients: ${clientsError.message}`)
    }
    
    if (!clients || clients.length === 0) {
      return { success: true, count: 0 }
    }
    
    // Calculate rating for each client
    let successCount = 0
    let errorCount = 0
    
    for (const client of clients) {
      try {
        const rating = await calculateClientRating(client.id)
        
        await supabase
          .from('clients')
          .update({
            rating: rating.rating,
            rating_score: rating.score,
          })
          .eq('id', client.id)
        
        successCount++
      } catch (error) {
        console.error(`Error calculating rating for client ${client.id}:`, error)
        errorCount++
      }
    }
    
    // Revalidate paths
    revalidatePath('/clients')
    revalidatePath('/clients/dashboard')
    
    return { 
      success: true, 
      count: successCount,
      errors: errorCount
    }
  } catch (error) {
    console.error('Error recalculating all ratings:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al recalcular las calificaciones'
    }
  }
}
