/**
 * GET /api/admin/logs
 * Unified audit log for admins — aggregates recent activity from:
 *   sales, payments, movements, collection_actions, audit_logs
 * Query params:
 *   limit    (default 200, max 500)
 *   category (all | ventas | cobros | inventario | cobranzas | ediciones)
 *   user_id  (filter by specific user)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('roles').eq('id', user.id).single()
  const roles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) return null
  return user
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
  const category = searchParams.get('category') || 'all'
  const filterUserId = searchParams.get('user_id') || null
  const dateFrom = searchParams.get('date_from') || null   // ISO string, e.g. '2026-03-01T00:00:00Z'
  const dateTo = searchParams.get('date_to') || null       // ISO string, e.g. '2026-03-31T23:59:59Z'

  const entries: any[] = []

  // ── Ventas ────────────────────────────────────────────────────────────────
  if (category === 'all' || category === 'ventas') {
    let q = supabase
      .from('sales')
      .select('id, created_at, user_id, store_id, total, sale_number, voided, users:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (filterUserId) q = q.eq('user_id', filterUserId) as typeof q
    if (dateFrom) q = q.gte('created_at', dateFrom) as typeof q
    if (dateTo) q = q.lte('created_at', dateTo) as typeof q
    const { data } = await q
    for (const r of data || []) {
      entries.push({
        id: `sale-${r.id}`,
        category: 'venta',
        action: r.voided ? 'Venta anulada' : 'Venta registrada',
        detail: `Ticket ${r.sale_number || r.id.slice(0, 8)} — S/ ${Number(r.total).toFixed(2)}`,
        store: r.store_id,
        user_id: r.user_id,
        user_name: (r.users as any)?.name || '—',
        created_at: r.created_at,
        severity: r.voided ? 'warning' : 'info',
      })
    }
  }

  // ── Cobros ────────────────────────────────────────────────────────────────
  if (category === 'all' || category === 'cobros') {
    let q = supabase
      .from('payments')
      .select('id, created_at, user_id, amount, payment_date, installment_id, users:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (filterUserId) q = q.eq('user_id', filterUserId) as typeof q
    if (dateFrom) q = q.gte('created_at', dateFrom) as typeof q
    if (dateTo) q = q.lte('created_at', dateTo) as typeof q
    const { data } = await q
    for (const r of data || []) {
      entries.push({
        id: `pay-${r.id}`,
        category: 'cobro',
        action: 'Cobro registrado',
        detail: `S/ ${Number(r.amount).toFixed(2)} — ${r.payment_date}`,
        store: null,
        user_id: r.user_id,
        user_name: (r.users as any)?.name || '—',
        created_at: r.created_at,
        severity: 'success',
      })
    }
  }

  // ── Movimientos de inventario ─────────────────────────────────────────────
  if (category === 'all' || category === 'inventario') {
    let q = supabase
      .from('movements')
      .select('id, created_at, user_id, type, quantity, warehouse_id, reference, products:product_id(name, barcode), users:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (filterUserId) q = q.eq('user_id', filterUserId) as typeof q
    if (dateFrom) q = q.gte('created_at', dateFrom) as typeof q
    if (dateTo) q = q.lte('created_at', dateTo) as typeof q
    const { data } = await q
    for (const r of data || []) {
      const isIn = r.type === 'IN' || r.type === 'ENTRADA'
      entries.push({
        id: `mov-${r.id}`,
        category: 'inventario',
        action: isIn ? 'Entrada de stock' : r.type === 'AJUSTE' ? 'Ajuste de stock' : 'Salida de stock',
        detail: `${(r.products as any)?.name || r.products} — ${isIn ? '+' : ''}${r.quantity} | ${r.warehouse_id}${r.reference ? ` (${r.reference})` : ''}`,
        store: r.warehouse_id,
        user_id: r.user_id,
        user_name: (r.users as any)?.name || '—',
        created_at: r.created_at,
        severity: isIn ? 'success' : 'info',
      })
    }
  }

  // ── Acciones de cobranza ──────────────────────────────────────────────────
  if (category === 'all' || category === 'cobranzas') {
    let q = supabase
      .from('collection_actions')
      .select('id, created_at, user_id, action_type, result, client_name, notes, users:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (filterUserId) q = q.eq('user_id', filterUserId) as typeof q
    if (dateFrom) q = q.gte('created_at', dateFrom) as typeof q
    if (dateTo) q = q.lte('created_at', dateTo) as typeof q
    const { data } = await q
    for (const r of data || []) {
      entries.push({
        id: `act-${r.id}`,
        category: 'cobranza',
        action: `Acción: ${r.action_type}`,
        detail: `${r.client_name} — ${r.result}${r.notes ? ` | ${r.notes}` : ''}`,
        store: null,
        user_id: r.user_id,
        user_name: (r.users as any)?.name || '—',
        created_at: r.created_at,
        severity: 'info',
      })
    }
  }

  // ── Ediciones / Borrados (audit_logs) ────────────────────────────────────
  if (category === 'all' || category === 'ediciones') {
    let q = supabase
      .from('audit_logs')
      .select('id, created_at, user_id, action, entity_type, entity_id, entity_name, detail, store, users:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (filterUserId) q = q.eq('user_id', filterUserId) as typeof q
    if (dateFrom) q = q.gte('created_at', dateFrom) as typeof q
    if (dateTo) q = q.lte('created_at', dateTo) as typeof q
    const { data } = await q
    for (const r of data || []) {
      const actionLabel = r.action === 'DELETE' ? 'Eliminado' : r.action === 'UPDATE' ? 'Editado' : 'Creado'
      const entityLabel: Record<string, string> = {
        product: 'Producto', client: 'Cliente', user: 'Usuario',
        catalog_line: 'Línea', catalog_category: 'Categoría',
        catalog_brand: 'Marca', catalog_size: 'Talla',
        catalog_supplier: 'Proveedor', product_image: 'Imagen',
        stock: 'Stock',
      }
      entries.push({
        id: `aud-${r.id}`,
        category: 'edicion',
        action: `${actionLabel}: ${entityLabel[r.entity_type] || r.entity_type}`,
        detail: r.detail || (r.entity_name ? `"${r.entity_name}"` : r.entity_id || '—'),
        store: r.store || null,
        user_id: r.user_id,
        user_name: (r.users as any)?.name || '—',
        created_at: r.created_at,
        severity: r.action === 'DELETE' ? 'warning' : 'info',
      })
    }
  }

  // Sort all by created_at desc and limit
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const result = entries.slice(0, limit)

  // Also return user list for filter dropdown
  const { data: userList } = await supabase
    .from('users').select('id, name, email').eq('active', true).order('name')

  return NextResponse.json({ success: true, data: result, users: userList || [] })
}
