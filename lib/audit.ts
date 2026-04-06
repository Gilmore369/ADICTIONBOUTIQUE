/**
 * Audit logging helper
 * Records CREATE / UPDATE / DELETE operations on key entities.
 * Always uses the service client (bypasses RLS) — safe because this
 * is only called from server-side code after auth checks.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface AuditPayload {
  userId: string | null
  action: AuditAction
  entityType: string   // 'product' | 'client' | 'user' | 'catalog_line' | 'catalog_brand' | etc.
  entityId?: string | null
  entityName?: string | null
  detail?: string | null
  store?: string | null
  oldValues?: Record<string, any> | null
  newValues?: Record<string, any> | null
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const service = createServiceClient()
    await service.from('audit_logs').insert({
      user_id:     payload.userId,
      action:      payload.action,
      entity_type: payload.entityType,
      entity_id:   payload.entityId ?? null,
      entity_name: payload.entityName ?? null,
      detail:      payload.detail ?? null,
      store:       payload.store ?? null,
      old_values:  payload.oldValues ?? null,
      new_values:  payload.newValues ?? null,
    })
  } catch (err) {
    // Never throw — audit failures should not break the main flow
    console.error('[audit] Failed to write audit log:', err)
  }
}
