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
  // Estrategia paralela: traer el primer lote para saber si hay más.
  // Si está lleno, disparar en paralelo los siguientes lotes en grupos de 4
  // hasta que uno devuelva menos que batchSize (fin de datos).
  const PARALLEL = 4
  const first = await queryFn(0, batchSize - 1)
  if (first.error) {
    console.error('[fetchAllRows] query error at offset 0', first.error)
    return []
  }
  const firstData = first.data || []
  if (firstData.length < batchSize) return firstData

  const all: T[] = [...firstData]
  let offset = batchSize
  let done = false
  while (!done) {
    const promises: Promise<{ data: T[] | null; error: any }>[] = []
    for (let i = 0; i < PARALLEL; i++) {
      const f = offset + i * batchSize
      promises.push(Promise.resolve(queryFn(f, f + batchSize - 1)))
    }
    const results = await Promise.all(promises)
    for (const r of results) {
      if (r.error) {
        console.error('[fetchAllRows] parallel batch error', r.error)
        done = true
        break
      }
      const rows = r.data || []
      if (rows.length === 0) { done = true; break }
      all.push(...rows)
      if (rows.length < batchSize) { done = true; break }
    }
    offset += PARALLEL * batchSize
  }
  return all
}
