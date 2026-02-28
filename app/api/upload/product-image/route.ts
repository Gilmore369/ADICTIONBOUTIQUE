/**
 * Product Image Upload API Route
 *
 * POST /api/upload/product-image
 * Body (multipart/form-data):
 *   file          File     required
 *   base_code     string   required  — model grouping key
 *   product_id    string   optional  — specific variant
 *   color         string   optional  — leave empty for model-level image
 *   is_primary    string   "true"|"false"  default "false"
 *
 * Returns: { success, data: { id, public_url, storage_path } }
 *
 * Storage layout:
 *   product-images/{base_code}/main.{ext}               ← model primary
 *   product-images/{base_code}/colors/{color}/{uuid}.{ext}  ← color image
 */

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const BUCKET = 'product-images'
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // ── Auth check ──────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse form data ─────────────────────────────────────────────────────
    const fd        = await request.formData()
    const file      = fd.get('file')      as File   | null
    const base_code = fd.get('base_code') as string | null
    const product_id = fd.get('product_id') as string | null
    const color     = (fd.get('color') as string | null)?.trim() || null
    const is_primary = fd.get('is_primary') === 'true'

    if (!file)      return err400('No file provided')
    if (!base_code) return err400('base_code is required')
    if (!file.type.startsWith('image/')) return err400('File must be an image')
    if (file.size > MAX_SIZE) return err400('File must be < 2 MB')

    // ── Build storage path ──────────────────────────────────────────────────
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const uid = randomUUID()
    let storagePath: string

    if (is_primary && !color) {
      // Model-level primary: deterministic path so it can be overwritten
      storagePath = `${base_code}/main.${ext}`
    } else if (color) {
      storagePath = `${base_code}/colors/${color}/${uid}.${ext}`
    } else {
      storagePath = `${base_code}/${uid}.${ext}`
    }

    // ── Ensure bucket exists — requires service_role key ───────────────────
    // createBucket() needs elevated permissions; use service client if available
    const adminClient = createServiceClient()
    if (adminClient) {
      const { error: bucketError } = await adminClient.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      })
      if (bucketError && !bucketError.message.toLowerCase().includes('already exist') &&
          !bucketError.message.toLowerCase().includes('duplicate')) {
        console.warn('[upload/product-image] Bucket create warning:', bucketError.message)
      }
    } else {
      // No service key configured — bucket must be created manually in Supabase Dashboard
      // Check if bucket exists before attempting upload
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === BUCKET)
      if (!bucketExists) {
        return NextResponse.json({
          success: false,
          error: `El bucket de Storage "${BUCKET}" no existe. Créalo en Supabase Dashboard → Storage, o agrega SUPABASE_SERVICE_ROLE_KEY en .env.local.`,
        }, { status: 500 })
      }
    }

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,  // allow overwriting primary
      })

    if (uploadError) {
      console.error('[upload/product-image] Storage error:', uploadError)
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })
    }

    // ── Get public URL ──────────────────────────────────────────────────────
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path)
    const public_url = urlData.publicUrl

    // ── If setting primary, clear existing primary first ───────────────────
    if (is_primary) {
      if (color) {
        await supabase
          .from('product_images')
          .update({ is_primary: false })
          .eq('base_code', base_code)
          .eq('color', color)
          .eq('is_primary', true)
      } else {
        await supabase
          .from('product_images')
          .update({ is_primary: false })
          .eq('base_code', base_code)
          .is('color', null)
          .eq('is_primary', true)
      }
    }

    // ── Persist to product_images table ────────────────────────────────────
    const insertPayload: Record<string, unknown> = {
      base_code,
      color,
      is_primary,
      storage_bucket: BUCKET,
      storage_path: uploadData.path,
      public_url,
    }
    if (product_id) insertPayload.product_id = product_id

    const { data: imgRow, error: dbError } = await supabase
      .from('product_images')
      .insert(insertPayload)
      .select()
      .single()

    if (dbError) {
      console.error('[upload/product-image] DB error:', dbError)
      // Still return success for the upload, just note DB issue
      return NextResponse.json({
        success: true,
        warning: 'Uploaded but failed to persist to DB: ' + dbError.message,
        data: { public_url, storage_path: uploadData.path },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id:           imgRow.id,
        public_url:   imgRow.public_url,
        storage_path: imgRow.storage_path,
        is_primary:   imgRow.is_primary,
        color:        imgRow.color,
      },
    })
  } catch (error) {
    console.error('[upload/product-image] Unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/upload/product-image?id=<image_id> ─────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return err400('id is required')

    // Get the image row first
    const { data: img } = await supabase
      .from('product_images')
      .select('storage_bucket, storage_path')
      .eq('id', id)
      .single()

    if (img) {
      // Delete from storage
      await supabase.storage.from(img.storage_bucket).remove([img.storage_path])
    }

    // Delete from DB
    const { error } = await supabase.from('product_images').delete().eq('id', id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function err400(msg: string) {
  return NextResponse.json({ success: false, error: msg }, { status: 400 })
}
