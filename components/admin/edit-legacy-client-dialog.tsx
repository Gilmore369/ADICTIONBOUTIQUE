'use client'

/**
 * EditLegacyClientDialog
 *
 * Dialog para corroborar / corregir los datos migrados (legacy) de un cliente:
 *   - Identidad: nombre, DNI, límite de crédito, contacto, notas
 *   - Deuda pendiente: ajusta el plan/cuota y recalcula credit_used
 *
 * Reutilizable desde la página de duplicados y desde el detalle del cliente.
 */

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import {
  getLegacyClientDetail,
  updateLegacyClientIdentity,
  setLegacyClientOutstanding,
  type LegacyClientDetail,
} from '@/actions/legacy-clients'

interface EditLegacyClientDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function EditLegacyClientDialog({ clientId, open, onOpenChange, onSaved }: EditLegacyClientDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<LegacyClientDetail | null>(null)

  // Campos editables
  const [name, setName] = useState('')
  const [dni, setDni] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  // Deuda
  const [editDebt, setEditDebt] = useState(false)
  const [newOutstanding, setNewOutstanding] = useState('')
  const [debtReason, setDebtReason] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setEditDebt(false)
    setDebtReason('')
    getLegacyClientDetail(clientId).then(res => {
      if (cancelled) return
      if (res.success && res.data) {
        const d = res.data
        setDetail(d)
        setName(d.name ?? '')
        setDni(d.dni ?? '')
        setCreditLimit(String(d.credit_limit ?? 0))
        setNotes(d.legacy_notes ?? '')
        setNewOutstanding(String(d.outstanding ?? 0))
      } else {
        toast.error(res.error || 'No se pudo cargar el cliente')
        onOpenChange(false)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, clientId, onOpenChange])

  const storeLabel = detail?.store === 'HOMBRES' ? 'Tienda Hombres'
    : detail?.store === 'MUJERES' ? 'Tienda Mujeres' : 'Otra'

  async function handleSave() {
    if (!detail) return
    setSaving(true)
    try {
      // 1) Identidad (siempre que haya cambios)
      const limitNum = parseFloat(creditLimit)
      const idRes = await updateLegacyClientIdentity({
        clientId,
        name: name.trim(),
        dni: dni.trim(),
        credit_limit: isNaN(limitNum) ? undefined : limitNum,
        phone: phone.trim() ? phone.trim() : undefined,
        email: email.trim() ? email.trim() : undefined,
        legacy_notes: notes.trim() ? notes.trim() : null,
      })
      // updateLegacyClientIdentity devuelve error si no hubo cambios; lo ignoramos
      if (!idRes.success && idRes.error && idRes.error !== 'No hay cambios para guardar') {
        toast.error(idRes.error)
        setSaving(false)
        return
      }

      // 2) Deuda (solo si el usuario la activó)
      if (editDebt) {
        const outNum = parseFloat(newOutstanding)
        if (isNaN(outNum) || outNum < 0) {
          toast.error('Ingresa un saldo válido')
          setSaving(false)
          return
        }
        if (debtReason.trim().length < 3) {
          toast.error('Indica el motivo del ajuste de deuda (mín. 3 caracteres)')
          setSaving(false)
          return
        }
        const debtRes = await setLegacyClientOutstanding({
          clientId,
          newOutstanding: outNum,
          reason: debtReason.trim(),
        })
        if (!debtRes.success) {
          toast.error(debtRes.error || 'No se pudo ajustar la deuda')
          setSaving(false)
          return
        }
        toast.success(
          debtRes.consolidated
            ? 'Datos guardados. La deuda se consolidó en un solo saldo.'
            : 'Datos y deuda actualizados.'
        )
      } else {
        toast.success('Datos del cliente actualizados.')
      }

      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar datos Legacy</DialogTitle>
          <DialogDescription>
            Corrige los datos migrados de este cliente para que coincidan con el sistema original.
          </DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{storeLabel}</Badge>
              <span className="text-muted-foreground">{detail.legacy_source}</span>
              {!detail.active && <Badge variant="destructive">Inactivo</Badge>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="leg-name">Nombre</Label>
              <Input id="leg-name" value={name} onChange={e => setName(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Puedes quitar sufijos confusos como (H), (M) o "+ 15".
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="leg-dni">DNI</Label>
                <Input id="leg-dni" value={dni} onChange={e => setDni(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leg-limit">Límite de crédito (S/)</Label>
                <Input id="leg-limit" type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="leg-phone">Teléfono</Label>
                <Input id="leg-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(sin cambios)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leg-email">Email</Label>
                <Input id="leg-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="(sin cambios)" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="leg-notes">Notas legacy</Label>
              <Textarea id="leg-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>

            {/* ── Sección deuda ── */}
            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Deuda pendiente</p>
                  <p className="text-lg font-semibold">{formatCurrency(detail.outstanding)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {detail.active_plan_count} plan(es) · {detail.open_installment_count} cuota(s) abierta(s)
                  </p>
                </div>
                {!editDebt ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditDebt(true)}>
                    Ajustar deuda
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEditDebt(false); setNewOutstanding(String(detail.outstanding)) }}>
                    Cancelar ajuste
                  </Button>
                )}
              </div>

              {editDebt && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="leg-out">Nuevo saldo pendiente (S/)</Label>
                    <Input id="leg-out" type="number" step="0.01" value={newOutstanding} onChange={e => setNewOutstanding(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="leg-reason">Motivo del ajuste *</Label>
                    <Input id="leg-reason" value={debtReason} onChange={e => setDebtReason(e.target.value)} placeholder="Ej: corrobora con sistema antiguo (S/7,135)" />
                  </div>
                  {detail.has_sale_linked_plans || detail.open_installment_count > 1 ? (
                    <div className="flex gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Este cliente tiene varias cuotas/planes con detalle por venta. Cambiar el total las
                        <strong> consolidará en un solo saldo</strong> (las ventas se conservan en el historial).
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2 text-[11px] text-muted-foreground bg-background rounded p-2 border">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Se editará la cuota legacy directamente. Reversible volviendo a poner el monto anterior.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
