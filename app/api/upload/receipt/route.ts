/**
 * Receipt Upload API
 * POST /api/upload/receipt
 * Body (multipart/form-data): file (image/pdf, max 5MB)
 * Returns: { success, data: { public_url } }
 */

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const BUCKET = 'receipts'
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const fd = await request.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Formato no soportado. Usa JPG, PNG, WEBP o PDF' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'El archivo supera los 5MB' }, { status: 400 })
    }

    const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
    const path = `payments/${user.id}/${randomUUID()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const serviceClient = createServiceClient()

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      // If bucket doesn't exist, return URL as null (non-blocking)
      console.warn('[receipt-upload] bucket error:', uploadError.message)
      return NextResponse.json({ success: true, data: { public_url: null } })
    }

    const { data: urlData } = serviceClient.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({ success: true, data: { public_url: urlData.publicUrl } })
  } catch (err: any) {
    console.error('[receipt-upload]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
