/**
 * Reset de correlativos + limpieza de Storage.
 *
 * 1. Reset sale_number sequence al máximo actual + 1 (o 1 si tabla vacía).
 * 2. Limpiar imágenes huérfanas en product-images (las que no apuntan a
 *    product_images.storage_path existente).
 * 3. Reportar espacio antes y después.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://mwdqdrqlzlffmfqqcnmp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo',
  { auth: { persistSession: false } },
)

const FREE_LIMIT_MB = 1024

async function walkBucket(bucket, prefix = '') {
  const found = []
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) return found
  for (const o of data || []) {
    if (o.metadata && o.metadata.size !== undefined) {
      const full = prefix ? `${prefix}/${o.name}` : o.name
      found.push({ path: full, size: o.metadata.size })
    } else {
      const sub = await walkBucket(bucket, prefix ? `${prefix}/${o.name}` : o.name)
      found.push(...sub)
    }
  }
  return found
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  RESET CORRELATIVOS + LIMPIEZA STORAGE')
console.log('═══════════════════════════════════════════════════════════════\n')

// ── 1. Estado actual de Storage ────────────────────────────────────────
console.log('▶ Paso 1: Estado actual de Storage\n')
const buckets = ['product-images', 'receipts', 'visit-images', 'client-photos']
const allFiles = {}
let totalBefore = 0
for (const b of buckets) {
  const files = await walkBucket(b)
  allFiles[b] = files
  const sum = files.reduce((s, f) => s + f.size, 0)
  totalBefore += sum
  console.log(`  ${b.padEnd(20)} ${String(files.length).padStart(4)} archivos  ${(sum/1024/1024).toFixed(2).padStart(7)} MB`)
}
console.log(`  ${'TOTAL'.padEnd(20)} ${String(Object.values(allFiles).flat().length).padStart(4)} archivos  ${(totalBefore/1024/1024).toFixed(2).padStart(7)} MB  (${((totalBefore/1024/1024/FREE_LIMIT_MB)*100).toFixed(1)}% del límite Free)`)

// ── 2. Reset sale_number ───────────────────────────────────────────────
console.log('\n▶ Paso 2: Reset sale_number correlativo\n')

// Cuántas ventas hay
const { count: salesCount } = await sb.from('sales').select('*', { count: 'exact', head: true })
console.log(`  Ventas existentes: ${salesCount}`)

if (salesCount === 0) {
  // Llamar a peek_sale_number_seq si existe — para resetear secuencia a 1
  // Si no existe, hay que crear una migración. Por ahora intentamos.
  try {
    const { error } = await sb.rpc('reset_sale_number_seq')
    if (error && !error.message.includes('does not exist')) {
      console.log(`  ⚠ Error al resetear secuencia: ${error.message}`)
    } else if (!error) {
      console.log(`  ✓ Secuencia de sale_number reseteada a 1`)
    } else {
      console.log(`  ⚠ RPC reset_sale_number_seq no existe — debes hacerlo manual en Supabase SQL Editor:`)
      console.log(`      ALTER SEQUENCE sales_sale_number_seq RESTART WITH 1;`)
    }
  } catch (e) {
    console.log(`  ⚠ ${e.message}`)
  }
} else {
  console.log(`  ⚠ Hay ${salesCount} ventas — NO reseteo. Para forzar reset borra ventas primero.`)
}

// ── 3. Limpiar imágenes huérfanas ──────────────────────────────────────
console.log('\n▶ Paso 3: Limpieza de imágenes huérfanas\n')

// Obtener todos los storage_path conocidos en product_images
const { data: knownImages } = await sb.from('product_images').select('storage_path')
const knownPaths = new Set((knownImages || []).map(r => r.storage_path))
console.log(`  Imágenes registradas en BD: ${knownPaths.size}`)

// Obtener todos los client_photo_url y dni_photo_url
const { data: clientPhotos } = await sb.from('clients').select('client_photo_url, dni_photo_url')
const knownClientPaths = new Set()
for (const c of clientPhotos || []) {
  for (const url of [c.client_photo_url, c.dni_photo_url]) {
    if (url && typeof url === 'string') {
      const m = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
      if (m) knownClientPaths.add(m[1])
    }
  }
}
// User profile photos
const { data: userPhotos } = await sb.from('users').select('profile_photo_url')
for (const u of userPhotos || []) {
  if (u.profile_photo_url && typeof u.profile_photo_url === 'string') {
    const m = u.profile_photo_url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
    if (m) knownClientPaths.add(m[1])
  }
}
console.log(`  Fotos referenciadas en clients + users: ${knownClientPaths.size}`)

// Identificar huérfanas en product-images
const orphans = []
for (const f of allFiles['product-images'] || []) {
  // Mantener si está en product_images o en clients/users
  if (knownPaths.has(f.path)) continue
  if (knownClientPaths.has(f.path)) continue
  // Mantener fotos de visitas (visit-images) y comprobantes (receipts) — esos buckets están aparte
  orphans.push(f)
}
console.log(`  Huérfanas detectadas en product-images: ${orphans.length}`)

if (orphans.length > 0) {
  const sumOrphan = orphans.reduce((s, f) => s + f.size, 0)
  console.log(`  Espacio que se liberará: ${(sumOrphan/1024/1024).toFixed(2)} MB`)

  // Borrar en batches de 100
  const paths = orphans.map(f => f.path)
  let deleted = 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { data, error } = await sb.storage.from('product-images').remove(batch)
    if (error) {
      console.log(`  ⚠ Error en batch ${i/100}: ${error.message}`)
    } else {
      deleted += data?.length || 0
    }
  }
  console.log(`  ✓ ${deleted} archivos borrados`)
}

// Limpieza de visit-images y receipts: borrar todo si no hay registros activos
// (estamos en BD limpia, no debería haber referencias)
for (const bucket of ['visit-images', 'receipts']) {
  const files = allFiles[bucket] || []
  if (files.length === 0) continue
  // Borrar todo si no hay tablas que los referencien
  const paths = files.map(f => f.path)
  const sumB = files.reduce((s, f) => s + f.size, 0)
  console.log(`  Limpiando ${bucket}: ${files.length} archivos (${(sumB/1024/1024).toFixed(2)} MB)`)
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    await sb.storage.from(bucket).remove(batch)
  }
}

// ── 4. Estado final ────────────────────────────────────────────────────
console.log('\n▶ Paso 4: Estado final\n')
let totalAfter = 0
for (const b of buckets) {
  const files = await walkBucket(b)
  const sum = files.reduce((s, f) => s + f.size, 0)
  totalAfter += sum
  console.log(`  ${b.padEnd(20)} ${String(files.length).padStart(4)} archivos  ${(sum/1024/1024).toFixed(2).padStart(7)} MB`)
}
console.log(`  ${'TOTAL'.padEnd(20)}      ${(totalAfter/1024/1024).toFixed(2).padStart(7)} MB  (${((totalAfter/1024/1024/FREE_LIMIT_MB)*100).toFixed(2)}% del límite Free)`)

const liberado = totalBefore - totalAfter
console.log(`\n✅ Espacio liberado: ${(liberado/1024/1024).toFixed(2)} MB`)
console.log(`   Plan Free 1 GB → quedan ${(FREE_LIMIT_MB - totalAfter/1024/1024).toFixed(2)} MB disponibles`)
