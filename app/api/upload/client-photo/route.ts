/**
 * Client Photo Upload API
 *
 * POST /api/upload/client-photo
 * Body (multipart/form-data):
 *   file   File     required
 *   type   string   'dni' | 'photo'   default 'photo'
 *
 * Returns: { success, data: { public_url } }
 *
 * Storage layout:  product-images/clients/{type}/{uuid}.{ext}
 * (Reuses the existing product-images bucket)
 */

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const BUCKET   = 'product-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB for ID photos

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const fd   = await request.formData()
    const file = fd.get('file') as File | null
    const type = (fd.get('type') as string | null) || 'photo' // 'dni' | 'photo'

    if (!file)                            return err400('No file provided')
    if (!file.type.startsWith('image/')) return err400('File must be an image')
    if (file.size > MAX_SIZE)             return err400('File must be < 5 MB')

    const ext         = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const uid         = randomUUID()
    const storagePath = `clients/${type}/${uid}.${ext}`

    // Ensure bucket exists
    const admin = createServiceClient()
    if (admin) {
      await admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }).catch(() => { /* bucket already exists — OK */ })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { data: upload, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadErr) {
      console.error('[upload/client-photo]', uploadErr)
      return NextResponse.json({ success: false, error: uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(upload.path)

    return NextResponse.json({ success: true, data: { public_url: publicUrl } })
  } catch (err) {
    console.error('[upload/client-photo] unexpected:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function err400(msg: string) {
  return NextResponse.json({ success: false, error: msg }, { status: 400 })
}
