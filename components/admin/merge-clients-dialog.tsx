'use client'

/**
 * MergeClientsDialog
 *
 * Une 2+ registros duplicados en un solo cliente. El usuario elige cuál registro
 * queda como PRINCIPAL (el que se conserva, idealmente el del DNI real). Todas las
 * compras, planes, pagos y cobranzas de los demás se re-apuntan al principal, sin
 * modificar ni borrar planes: el cliente único queda con deuda en ambas tiendas
 * (separada por tienda vía legacy_source/store_id). Los duplicados quedan
 * desactivados y marcados como fusionados.
 */

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, GitMerge, AlertTriangle, Check } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { mergeDuplicateClients, type LegacyClientRecord } from '@/actions/legacy-clients'

interface MergeClientsDialogProps {
  records: LegacyClientRecord[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onMerged?: () => void
}

export function MergeClientsDialog({ records, open, onOpenChange, onMerged }: MergeClientsDialogProps) {
  // Por defecto, el principal es el de DNI real (no placeholder) con mayor deuda
  const defaultPrimary = [...records]
    .sort((a, b) => {
      if (a.placeholder_dni !== b.placeholder_dni) return a.placeholder_dni ? 1 : -1
      return b.credit_used - a.credit_used
    })[0]?.id
  const [primaryId, setPrimaryId] = useState<string>(defaultPrimary)
  const [saving, setSaving] = useState(false)

  const totalDebt = records.reduce((s, r) => s + r.credit_used, 0)

  async function handleMerge() {
    if (!primaryId) { toast.error('Elige el registro principal'); return }
    const secondaryIds = records.filter(r => r.id !== primaryId).map(r => r.id)
    setSaving(true)
    const res = await mergeDuplicateClients({ primaryId, secondaryIds })
    setSaving(false)
    if (res.success) {
      const movedPlans = res.moved?.['credit_plans'] ?? 0
      const movedSales = res.moved?.['sales'] ?? 0
      toast.success(`Clientes unidos. Se movieron ${movedPlans} plan(es) y ${movedSales} venta(s) al cliente único.`)
      onMerged?.()
      onOpenChange(false)
    } else {
      toast.error(res.error || 'No se pudieron unir los registros')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" /> Unir registros duplicados
          </DialogTitle>
          <DialogDescription>
            Elige el registro que se conservará. Las compras, planes y deudas de los demás se
            moverán a ese cliente único — <strong>no se borra ni modifica ningún plan ni venta</strong>.
            La deuda seguirá separada por tienda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Cliente principal (se conserva):</p>
          {records.map(rec => {
            const isPrimary = rec.id === primaryId
            const storeLabel = rec.store === 'HOMBRES' ? 'Hombres' : rec.store === 'MUJERES' ? 'Mujeres' : 'Otra'
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => setPrimaryId(rec.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  isPrimary ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${isPrimary ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground'}`}>
                        {isPrimary && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="text-sm font-medium truncate">{rec.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      DNI: {rec.dni} {rec.placeholder_dni && <span className="text-amber-600">(ficticio)</span>} · {storeLabel}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-semibold ${rec.credit_used > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatCurrency(rec.credit_used)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
          <p>El cliente único quedará con deuda total <strong>{formatCurrency(totalDebt)}</strong> (suma de ambas tiendas, separada por tienda).</p>
          <p>Los {records.length - 1} registro(s) restante(s) quedarán <strong>desactivados</strong> y marcados como fusionados.</p>
        </div>

        <div className="flex gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Verifica que ambos registros sean realmente la <strong>misma persona</strong> antes de unir. Esta acción mueve todas sus compras a un solo cliente.</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleMerge} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitMerge className="h-4 w-4 mr-2" />}
            Unir en un solo cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
