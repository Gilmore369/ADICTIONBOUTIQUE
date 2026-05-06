/**
 * API Route: Store Settings
 * GET  → Read store config from system_config table
 * POST → Save store config to system_config table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'

const CONFIG_KEYS = ['store_name', 'store_address', 'store_phone', 'store_ruc', 'store_logo']

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', CONFIG_KEYS)

    if (error) {
      console.error('[settings] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const config: Record<string, string> = {}
    for (const row of data || []) {
      config[row.key] = row.value
    }

    return NextResponse.json({
      name:    config['store_name']    || 'ADICTION BOUTIQUE',
      address: config['store_address'] || '',
      phone:   config['store_phone']   || '',
      ruc:     config['store_ruc']     || '',
      logo:    config['store_logo']    || '',
    })
  } catch (error) {
    console.error('[settings] GET exception:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Only admins can change store identity (logo, name, RUC, etc.)
    // MANAGE_USERS is the admin-only permission per ROLE_PERMISSIONS.
    const allowed = await checkPermission(Permission.MANAGE_USERS)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar la configuración de la tienda' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, address, phone, ruc, logo } = body

    const upserts = [
      { key: 'store_name',    value: name    || 'ADICTION BOUTIQUE' },
      { key: 'store_address', value: address || '' },
      { key: 'store_phone',   value: phone   || '' },
      { key: 'store_ruc',     value: ruc     || '' },
    ]

    // Logo guardado como data-URL base64 en system_config.store_logo.
    // Antes el límite era 600 000 chars (~375 KB de imagen real) y se
    // descartaba SILENCIOSAMENTE — el admin subía un PNG de 500 KB y el
    // logo nunca aparecía. Ahora:
    //   - Límite 4.5 MB de base64 (~3.3 MB de imagen). El upload del
    //     formulario ya rechaza > 2 MB en cliente, así que esto deja
    //     margen para PNGs sin comprimir / formatos más grandes.
    //   - Si llega algo más grande, devolvemos 413 con mensaje claro
    //     en lugar de tirar a la basura.
    //   - Si el cliente envía un string vacío, BORRAMOS la fila para
    //     poder "quitar logo" desde el formulario.
    const LOGO_LIMIT_CHARS = 4_500_000
    if (typeof logo === 'string') {
      if (logo === '') {
        const { error: delErr } = await supabase
          .from('system_config')
          .delete()
          .eq('key', 'store_logo')
        if (delErr) console.warn('[settings] logo delete:', delErr.message)
      } else if (logo.length <= LOGO_LIMIT_CHARS) {
        upserts.push({ key: 'store_logo', value: logo })
      } else {
        return NextResponse.json(
          {
            error: `El logo es demasiado grande (${(logo.length / 1024 / 1024).toFixed(1)} MB en base64). ` +
                   `Máximo permitido: ${(LOGO_LIMIT_CHARS / 1024 / 1024).toFixed(1)} MB. ` +
                   `Sube una imagen más pequeña (recomendado: 200x200 PNG/JPG).`,
          },
          { status: 413 }
        )
      }
    }

    for (const item of upserts) {
      const { error } = await supabase
        .from('system_config')
        .upsert({ key: item.key, value: item.value }, { onConflict: 'key' })
      if (error) {
        console.error(`[settings] upsert ${item.key} error:`, error)
        return NextResponse.json(
          { error: `No se pudo guardar ${item.key}: ${error.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[settings] POST exception:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
