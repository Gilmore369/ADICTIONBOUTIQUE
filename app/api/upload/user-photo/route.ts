/**
 * User Profile Photo Upload API
 *
 * POST /api/upload/user-photo
 * Body (multipart/form-data):
 *   file   File     required
 *
 * Returns: { success, data: { public_url } }
 *
 * Storage layout: product-images/users/{user_id}.{ext}
 * (Reuses the existing product-images bucket)
 */

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

const BUCKET   = 'product-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB for profile photos

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const fd   = await request.formData()
    const file = fd.get('file') as File | null

    if (!file)                            return err400('No file provided')
    if (!file.type.startsWith('image/')) return err400('File must be an image')
    if (file.size > MAX_SIZE)             return err400('File must be < 5 MB')

    const ext         = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const storagePath = `users/${user.id}.${ext}`

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
      .upload(storagePath, buffer, { contentType: file.type, upsert: true }) // upsert: true to replace existing

    if (uploadErr) {
      console.error('[upload/user-photo]', uploadErr)
      return NextResponse.json({ success: false, error: uploadErr.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    // Update user profile with new photo URL
    const { error: updateErr } = await supabase
      .from('users')
      .update({ profile_photo_url: publicUrl })
      .eq('id', user.id)

    if (updateErr) {
      console.error('[upload/user-photo] Failed to update user profile:', updateErr)
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { public_url: publicUrl }
    })

  } catch (err: any) {
    console.error('[upload/user-photo]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function err400(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 })
}