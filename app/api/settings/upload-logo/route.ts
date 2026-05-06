/**
 * API Route: Upload Store Logo
 * 
 * Guarda el logo de la tienda en el servidor
 * para que esté disponible para la generación de PDFs
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación (solo admin puede cambiar el logo)
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // RBAC: only admins. The previous version trusted any authenticated user,
    // so a vendedor could overwrite the store logo.
    const allowed = await checkPermission(Permission.MANAGE_USERS)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permisos para cambiar el logo' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'El archivo debe ser una imagen' },
        { status: 400 }
      )
    }

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'La imagen no debe superar 2MB' },
        { status: 400 }
      )
    }

    console.log('[upload-logo] Processing file:', file.name, file.type, file.size)

    // Convertir a buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Crear directorio si no existe
    const imagesDir = path.join(process.cwd(), 'public', 'images')
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true })
      console.log('[upload-logo] Created images directory')
    }

    // Guardar archivo como logo.png (siempre sobrescribir)
    const filePath = path.join(imagesDir, 'logo.png')
    await writeFile(filePath, buffer)

    const logoDataUrl = `data:${file.type};base64,${buffer.toString('base64')}`
    const service = createServiceClient()
    const { error: configError } = await service
      .from('system_config')
      .upsert({ key: 'store_logo', value: logoDataUrl }, { onConflict: 'key' })

    if (configError) {
      console.error('[upload-logo] system_config upsert error:', configError)
      return NextResponse.json(
        { error: `Logo guardado como archivo, pero no se pudo persistir globalmente: ${configError.message}` },
        { status: 500 }
      )
    }

    console.log('[upload-logo] Logo saved successfully to:', filePath)

    return NextResponse.json({
      success: true,
      message: 'Logo guardado exitosamente',
      logo: logoDataUrl,
      path: '/images/logo.png'
    })
  } catch (error) {
    console.error('[upload-logo] Error:', error)
    return NextResponse.json(
      { error: 'Error al guardar el logo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
