/**
 * Reporta uso real de Supabase Storage por bucket.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://mwdqdrqlzlffmfqqcnmp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo',
  { auth: { persistSession: false } }
)

const buckets = ['product-images', 'receipts', 'visit-images', 'client-photos']

async function walkBucket(bucket, prefix = '') {
  let total = 0
  let count = 0
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) {
    console.log(`  ✗ ${bucket}/${prefix}: ${error.message}`)
    return { count: 0, size: 0 }
  }
  for (const o of data || []) {
    if (o.metadata && o.metadata.size !== undefined) {
      total += o.metadata.size
      count += 1
    } else {
      // es carpeta — recursivo
      const sub = await walkBucket(bucket, prefix ? `${prefix}/${o.name}` : o.name)
      total += sub.size
      count += sub.count
    }
  }
  return { count, size: total }
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  USO DE SUPABASE STORAGE')
console.log('═══════════════════════════════════════════════════════════════\n')

let grandSize = 0
let grandCount = 0
for (const b of buckets) {
  const { count, size } = await walkBucket(b)
  const mb = size / 1024 / 1024
  console.log(`  ${b.padEnd(20)} ${String(count).padStart(5)} archivos  ${mb.toFixed(2).padStart(8)} MB`)
  grandSize += size
  grandCount += count
}
console.log('  ' + '─'.repeat(50))
console.log(`  ${'TOTAL'.padEnd(20)} ${String(grandCount).padStart(5)} archivos  ${(grandSize/1024/1024).toFixed(2).padStart(8)} MB`)

const FREE_LIMIT_MB = 1024 // 1 GB
const usedPct = (grandSize / 1024 / 1024 / FREE_LIMIT_MB) * 100
console.log(`\n  Plan Free: ${FREE_LIMIT_MB} MB`)
console.log(`  Usado:     ${(grandSize/1024/1024).toFixed(2)} MB  (${usedPct.toFixed(2)}%)`)
console.log(`  Libre:     ${(FREE_LIMIT_MB - grandSize/1024/1024).toFixed(2)} MB`)
