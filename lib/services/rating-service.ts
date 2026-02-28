/**
 * Rating Service
 * 
 * Calculates client ratings based on payment behavior, purchase frequency,
 * total purchases, and client tenure.
 * 
 * Algorithm:
 * - Payment Punctuality: 40% weight
 * - Purchase Frequency: 30% weight
 * - Total Purchase Amount: 20% weight
 * - Client Tenure: 10% weight
 * 
 * Rating Categories:
 * - A: 90-100 (Excellent)
 * - B: 70-89 (Good)
 * - C: 50-69 (Regular)
 * - D: 0-49 (Poor)
 */

import { createServerClient } from '@/lib/supabase/server'
import { ClientRating, RatingCategory } from '@/lib/types/crm'
import { differenceInDays, differenceInMonths } from 'date-fns'

/**
 * Calculate client rating based on payment behavior and purchase history
 * 
 * @param clientId - UUID of the client to rate
 * @returns ClientRating object with score and category
 * 
 * @example
 * ```typescript
 * const rating = await calculateClientRating('client-uuid-123')
 * console.log(`Rating: ${rating.rating} (${rating.score}/100)`)
 * ```
 */
export async function calculateClientRating(clientId: string): Promise<ClientRating> {
  const supabase = await createServerClient()
  
  // Step 1: Fetch all required data in parallel
  const [installmentsResult, purchasesResult, clientResult] = await Promise.all([
    // Fetch all installments for the client
    supabase
      .from('installments')
      .select(`
        id,
        amount,
        due_date,
        paid_amount,
        status,
        paid_at,
        credit_plans!inner(client_id)
      `)
      .eq('credit_plans.client_id', clientId),
    
    // Fetch all purchases for the client
    supabase
      .from('sales')
      .select('id, total, created_at')
      .eq('client_id', clientId)
      .eq('voided', false)
      .order('created_at', { ascending: true }),
    
    // Fetch client data
    supabase
      .from('clients')
      .select('id, name, created_at')
      .eq('id', clientId)
      .single()
  ])
  
  const installments = installmentsResult.data || []
  const purchases = purchasesResult.data || []
  const client = clientResult.data
  
  // Handle edge case: client with no purchase history
  if (!client || purchases.length === 0) {
    return {
      client_id: clientId,
      rating: RatingCategory.C,
      score: 50,
      payment_punctuality: 50,
      purchase_frequency: 50,
      total_purchases: 0,
      client_tenure_days: 0,
      last_calculated: new Date()
    }
  }
  
  // Step 2: Calculate payment punctuality (40% weight)
  let paidOnTime = 0
  let totalPaid = 0
  
  for (const inst of installments) {
    if (inst.status === 'PAID' || inst.status === 'PARTIAL') {
      totalPaid++
      
      if (inst.paid_at) {
        const daysDiff = differenceInDays(new Date(inst.paid_at), new Date(inst.due_date))
        if (daysDiff <= 0) {
          paidOnTime++
        }
      }
    }
  }
  
  // Default to 50 if no payment history
  const punctuality = totalPaid > 0 ? (paidOnTime / totalPaid) * 100 : 50
  
  // Step 3: Calculate purchase frequency (30% weight)
  const firstPurchaseDate = purchases[0]?.created_at
  const monthsSinceFirst = firstPurchaseDate 
    ? differenceInMonths(new Date(), new Date(firstPurchaseDate))
    : 1
  
  const purchasesPerMonth = purchases.length / Math.max(monthsSinceFirst, 1)
  // Normalize: 5 purchases/month = 100 score
  const frequencyScore = Math.min(purchasesPerMonth * 20, 100)
  
  // Step 4: Calculate total purchase amount (20% weight)
  const totalSpent = purchases.reduce((sum, p) => sum + (p.total || 0), 0)
  // Normalize: $10,000 = 100 score
  const amountScore = Math.min(totalSpent / 100, 100)
  
  // Step 5: Calculate client tenure (10% weight)
  const tenureDays = firstPurchaseDate
    ? differenceInDays(new Date(), new Date(firstPurchaseDate))
    : 0
  // Normalize: 365 days = 100 score
  const tenureScore = Math.min(tenureDays / 3.65, 100)
  
  // Step 6: Calculate weighted final score
  const finalScore = 
    (punctuality * 0.4) +
    (frequencyScore * 0.3) +
    (amountScore * 0.2) +
    (tenureScore * 0.1)
  
  // Step 7: Assign rating category
  let rating: RatingCategory
  if (finalScore >= 90) {
    rating = RatingCategory.A
  } else if (finalScore >= 70) {
    rating = RatingCategory.B
  } else if (finalScore >= 50) {
    rating = RatingCategory.C
  } else {
    rating = RatingCategory.D
  }
  
  // Step 8: Return rating object
  return {
    client_id: clientId,
    rating,
    score: Math.round(finalScore),
    payment_punctuality: Math.round(punctuality),
    purchase_frequency: Math.round(frequencyScore),
    total_purchases: purchases.length,
    client_tenure_days: tenureDays,
    last_calculated: new Date()
  }
}
