/**
 * Supabase PostgREST has a server-side max_rows cap (default 1000 rows per request).
 * Even if you call .limit(10000), you only get 1000.
 *
 * Use fetchAllRows() to transparently paginate and return ALL rows.
 */

type RangeQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>

/**
 * Fetches ALL rows by calling the query in batches of `batchSize` (default 1000).
 * Stops when a batch returns fewer rows than requested.
 *
 * Usage:
 *   const allClients = await fetchAllRows(
 *     (from, to) => supabase.from('clients').select('id, name').eq('active', true).range(from, to)
 *   )
 */
export async function fetchAllRows<T>(
  queryFn: RangeQuery<T>,
  batchSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await queryFn(from, from + batchSize - 1)
    if (error) {
      console.error('[fetchAllRows] query error at offset', from, error)
      break
    }
    if (!data?.length) break
    all.push(...data)
    if (data.length < batchSize) break   // last page
    from += batchSize
  }

  return all
}
