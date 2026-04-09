/**
 * Store filter helpers for API routes
 *
 * Users with a restricted store (e.g., only MUJERES) should only see
 * clients whose credit plans come from sales in that store.
 */

export const STORE_DISPLAY_NAMES: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

/**
 * Returns the list of allowed store display names for the current user,
 * or null if the user has access to all stores.
 */
export async function getAllowedStoreNames(supabase: any): Promise<string[] | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('stores')
    .eq('id', user.id)
    .single()

  const userStores: string[] = (profile as any)?.stores || []

  // No restriction if user has 0 (unset) or both stores
  const upper = userStores.map(s => s.toUpperCase())
  const hasAllAccess =
    userStores.length === 0 ||
    (upper.includes('MUJERES') && upper.includes('HOMBRES'))

  if (hasAllAccess) return null

  return upper.map(s => STORE_DISPLAY_NAMES[s] || s)
}

/**
 * Given a list of allowed store display names, returns the IDs of
 * credit_plans whose originating sale belongs to one of those stores.
 * Returns an empty array when the store has no sales yet.
 */
export async function getAllowedPlanIds(
  supabase: any,
  storeNames: string[]
): Promise<string[]> {
  const { data: storeSales } = await supabase
    .from('sales')
    .select('id')
    .in('store_id', storeNames)

  const saleIds = (storeSales || []).map((s: any) => s.id)
  if (saleIds.length === 0) return []

  const { data: plans } = await supabase
    .from('credit_plans')
    .select('id')
    .in('sale_id', saleIds)

  return (plans || []).map((p: any) => p.id)
}

/**
 * Returns unique client IDs that have at least one credit plan
 * originating from a sale in the allowed stores.
 */
export async function getAllowedClientIds(
  supabase: any,
  storeNames: string[]
): Promise<string[]> {
  const { data: storeSales } = await supabase
    .from('sales')
    .select('id')
    .in('store_id', storeNames)

  const saleIds = (storeSales || []).map((s: any) => s.id)
  if (saleIds.length === 0) return []

  const { data: plans } = await supabase
    .from('credit_plans')
    .select('client_id')
    .in('sale_id', saleIds)

  return [...new Set((plans || []).map((p: any) => p.client_id).filter(Boolean))] as string[]
}
