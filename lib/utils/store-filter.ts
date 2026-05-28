/**
 * Store filter helpers for API routes
 *
 * Users with a restricted store (e.g., only MUJERES) should only see
 * clients whose credit plans come from sales in that store.
 */

import { fetchAllRows } from '@/lib/supabase/paginate'

export const STORE_DISPLAY_NAMES: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

/**
 * Trae TODOS los planes activos con su tienda derivada (legacy_source O sale.store_id).
 * Mismo criterio que /api/credit-plans: Hombres = BoutiqueV/Hombres; resto = Mujeres.
 * Pagina con fetchAllRows para superar el cap de 1000.
 */
async function fetchActivePlansWithStore(supabase: any): Promise<
  { id: string; client_id: string | null; store: string }[]
> {
  const rows = await fetchAllRows<any>((from, to) =>
    supabase
      .from('credit_plans')
      .select('id, client_id, legacy_source, sale:sales(store_id)')
      .in('status', ['ACTIVE', 'OVERDUE'])
      .range(from, to)
  )
  return (rows || []).map((p: any) => {
    const src = (p.legacy_source || '').toLowerCase()
    const saleStore = (p.sale as any)?.store_id
    const isHombres = src.includes('hombres') || src.includes('boutiquev') || saleStore === 'Tienda Hombres'
    return {
      id: p.id,
      client_id: p.client_id,
      store: isHombres ? 'Tienda Hombres' : 'Tienda Mujeres',
    }
  })
}

/**
 * Returns the list of allowed store display names for the current user,
 * or null if the user has access to all stores.
 *
 * @param requestedStore - Optional UI store selection ('MUJERES' | 'HOMBRES' | 'ALL').
 *   When provided and the user has access to that store, the result is scoped to
 *   that single store. This allows admins to filter the map by selected store.
 */
export async function getAllowedStoreNames(
  supabase: any,
  requestedStore?: string | null
): Promise<string[] | null> {
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

  // If caller requested a specific store and user has access to it → scope to that store
  if (requestedStore && requestedStore !== 'ALL') {
    const reqUpper = requestedStore.toUpperCase()
    const userHasAccess = hasAllAccess || upper.includes(reqUpper)
    if (userHasAccess) {
      const displayName = STORE_DISPLAY_NAMES[reqUpper]
      return displayName ? [displayName] : null
    }
    // User doesn't have access to requested store → fall through to their own restriction
  }

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
  const allowed = new Set(storeNames)
  const plans = await fetchActivePlansWithStore(supabase)
  return plans.filter(p => allowed.has(p.store)).map(p => p.id)
}

/**
 * Returns unique client IDs that have at least one credit plan
 * originating from a sale in the allowed stores.
 */
export async function getAllowedClientIds(
  supabase: any,
  storeNames: string[]
): Promise<string[]> {
  const allowed = new Set(storeNames)
  const plans = await fetchActivePlansWithStore(supabase)
  return [...new Set(
    plans.filter(p => allowed.has(p.store)).map(p => p.client_id).filter(Boolean)
  )] as string[]
}
