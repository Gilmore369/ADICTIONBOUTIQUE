'use client'

/**
 * LegacyClientsView — Revisión de clientes duplicados entre tiendas
 *
 * Muestra a las personas que quedaron con DOS registros tras la migración
 * (uno por tienda), lado a lado, con su deuda por tienda. Permite:
 *   - Editar los datos legacy de cada registro (nombre, DNI, límite, deuda)
 *   - Desactivar el registro duplicado sobrante (reversible)
 */

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Search, Users, AlertTriangle, RefreshCw, Pencil, UserX, UserCheck, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import {
  findCrossStoreDuplicates,
  deactivateDuplicateClient,
  reactivateDuplicateClient,
  type DuplicateGroup,
  type LegacyClientRecord,
} from '@/actions/legacy-clients'
import { EditLegacyClientDialog } from './edit-legacy-client-dialog'

export function LegacyClientsView() {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [stats, setStats] = useState({ total_groups: 0, records_involved: 0, with_debt: 0, total_debt: 0 })
  const [search, setSearch] = useState('')
  const [onlyDebt, setOnlyDebt] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await findCrossStoreDuplicates()
    if (res.success) {
      setGroups(res.groups)
      setStats(res.stats)
    } else {
      toast.error(res.error || 'No se pudieron cargar los duplicados')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return groups.filter(g => {
      if (onlyDebt && !g.has_debt) return false
      if (!q) return true
      return g.display_name.toLowerCase().includes(q)
        || g.records.some(r => r.name.toLowerCase().includes(q) || (r.dni || '').toLowerCase().includes(q))
    })
  }, [groups, search, onlyDebt])

  async function handleDeactivate(rec: LegacyClientRecord) {
    if (rec.credit_used > 1) {
      const ok = window.confirm(
        `⚠ Este registro tiene deuda de ${formatCurrency(rec.credit_used)}. ` +
        `Si lo desactivas, esa deuda dejará de verse en cobranzas. ¿Continuar?`
      )
      if (!ok) return
    }
    const reason = window.prompt('Motivo (ej: duplicado, la deuda real está en el otro registro):', 'Duplicado entre tiendas')
    if (reason === null) return
    setBusyId(rec.id)
    const res = await deactivateDuplicateClient({ clientId: rec.id, reason })
    setBusyId(null)
    if (res.success) { toast.success('Registro desactivado'); load() }
    else toast.error(res.error || 'No se pudo desactivar')
  }

  async function handleReactivate(rec: LegacyClientRecord) {
    setBusyId(rec.id)
    const res = await reactivateDuplicateClient({ clientId: rec.id })
    setBusyId(null)
    if (res.success) { toast.success('Registro reactivado'); load() }
    else toast.error(res.error || 'No se pudo reactivar')
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Personas duplicadas" value={String(stats.total_groups)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Registros involucrados" value={String(stats.records_involved)} />
        <StatCard label="Con deuda" value={String(stats.with_debt)} accent="amber" />
        <StatCard label="Deuda total (duplicados)" value={formatCurrency(stats.total_debt)} accent="rose" />
      </div>

      {/* Explicación */}
      <div className="flex gap-2 text-xs text-muted-foreground bg-muted/40 border rounded-lg p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <p>
          Estas personas tienen un registro en <strong>cada tienda</strong> (Mujeres = DBAdiction, Hombres = BoutiqueV)
          porque cada sistema antiguo usaba su propio DNI. Los sufijos <strong>(H)/(M)</strong> del nombre vienen del sistema
          original y <strong>no</strong> indican la tienda. Revisa la deuda por tienda, corrige los datos y desactiva el registro
          sobrante si corresponde.
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o DNI…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={onlyDebt} onChange={e => setOnlyDebt(e.target.checked)} className="h-4 w-4" />
          Solo con deuda
        </label>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Analizando clientes…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No hay duplicados que coincidan con el filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => (
            <Card key={group.key} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{group.display_name}</h3>
                {group.has_debt && (
                  <Badge variant="outline" className="text-rose-600 border-rose-200">
                    Deuda total {formatCurrency(group.total_debt)}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.records.map(rec => (
                  <RecordCard
                    key={rec.id}
                    rec={rec}
                    busy={busyId === rec.id}
                    onEdit={() => setEditing(rec.id)}
                    onDeactivate={() => handleDeactivate(rec)}
                    onReactivate={() => handleReactivate(rec)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditLegacyClientDialog
          clientId={editing}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}

function RecordCard({ rec, busy, onEdit, onDeactivate, onReactivate }: {
  rec: LegacyClientRecord
  busy: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const storeColor = rec.store === 'HOMBRES'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
    : rec.store === 'MUJERES'
    ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300'
    : 'bg-muted text-muted-foreground'
  const storeLabel = rec.store === 'HOMBRES' ? 'Hombres' : rec.store === 'MUJERES' ? 'Mujeres' : 'Otra'

  return (
    <div className={`rounded-lg border p-3 ${!rec.active ? 'opacity-60 bg-muted/40' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${storeColor}`}>{storeLabel}</span>
            {rec.placeholder_dni && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                DNI ficticio
              </span>
            )}
            {!rec.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Inactivo</span>}
          </div>
          <p className="text-sm font-medium mt-1 truncate" title={rec.name}>{rec.name}</p>
          <p className="text-xs text-muted-foreground">DNI: {rec.dni}</p>
          {rec.phone && <p className="text-xs text-muted-foreground">Tel: {rec.phone}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted-foreground">Deuda</p>
          <p className={`text-base font-semibold ${rec.credit_used > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatCurrency(rec.credit_used)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={onEdit} disabled={busy} className="h-7 px-2 text-xs">
          <Pencil className="h-3 w-3 mr-1" /> Editar legacy
        </Button>
        <Link href={`/clients/${rec.id}`} target="_blank">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <ExternalLink className="h-3 w-3 mr-1" /> Ver
          </Button>
        </Link>
        {rec.active ? (
          <Button size="sm" variant="ghost" onClick={onDeactivate} disabled={busy} className="h-7 px-2 text-xs text-red-600 hover:text-red-700">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserX className="h-3 w-3 mr-1" /> Desactivar</>}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onReactivate} disabled={busy} className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserCheck className="h-3 w-3 mr-1" /> Reactivar</>}
          </Button>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: string; icon?: React.ReactNode; accent?: 'amber' | 'rose'
}) {
  const accentClass = accent === 'amber' ? 'text-amber-600' : accent === 'rose' ? 'text-rose-600' : 'text-foreground'
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={`text-xl font-semibold mt-1 ${accentClass}`}>{value}</p>
    </Card>
  )
}
