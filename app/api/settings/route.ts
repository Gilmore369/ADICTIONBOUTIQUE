/**
 * API Route: Store Settings
 * GET  → Read store config from system_config table
 * POST → Save store config to system_config table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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

    const body = await request.json()
    const { name, address, phone, ruc, logo } = body

    const upserts = [
      { key: 'store_name',    value: name    || 'ADICTION BOUTIQUE' },
      { key: 'store_address', value: address || '' },
      { key: 'store_phone',   value: phone   || '' },
      { key: 'store_ruc',     value: ruc     || '' },
    ]

    // Only save logo if provided and not too large (>500KB as base64 is ~375KB)
    if (logo && logo.length < 600000) {
      upserts.push({ key: 'store_logo', value: logo })
    }

    for (const item of upserts) {
      const { error } = await supabase
        .from('system_config')
        .upsert({ key: item.key, value: item.value }, { onConflict: 'key' })
      if (error) {
        console.error(`[settings] upsert ${item.key} error:`, error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[settings] POST exception:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
