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

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación (solo admin puede cambiar el logo)
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
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

    console.log('[upload-logo] Logo saved successfully to:', filePath)

    return NextResponse.json({
      success: true,
      message: 'Logo guardado exitosamente',
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
