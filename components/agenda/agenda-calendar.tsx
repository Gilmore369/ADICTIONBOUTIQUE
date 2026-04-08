'use client'

/**
 * AgendaCalendar — Calendario de eventos con recordatorios y visitas programadas
 * - Cumpleaños (rosa)
 * - Cuotas vencidas / por vencer (rojo / naranja)
 * - Recordatorios (violeta)
 * - Visitas programadas (índigo)
 * Clic en día vacío → crear recordatorio o programar visita
 * Visitas → botón "Ver ruta en mapa"
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Cake, AlertTriangle, DollarSign,
  Phone, MessageCircle, Loader2, CalendarDays, Users, Clock,
  Bell, MapPin, Plus, X, Trash2, CheckCircle2, Search,
  CalendarCheck, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTodayPeru } from '@/lib/utils/timezone'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AgendaEvent {
  id: string
  type: 'birthday' | 'installment_due' | 'installment_overdue' | 'reminder' | 'scheduled_visit'
  date: string
  title: string
  subtitle?: string
  client_id?: string
  client_name?: string
  amount?: number
  phone?: string
  color: string
  reminder_id?: string
  visit_id?: string
  visit_type?: string
  client_ids?: string[]
  status?: string
  note?: string | null
}

interface AgendaData {
  year: number; month: number
  events: AgendaEvent[]
  summary: { birthdays: number; due: number; overdue: number; reminders: number; visits: number }
}

interface ClientOption { id: string; name: string; phone: string | null; credit_used: number }

// ─── Constants ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const REMINDER_COLORS = [
  { key: 'purple', hex: '#8b5cf6', label: 'Violeta' },
  { key: 'blue',   hex: '#3b82f6', label: 'Azul' },
  { key: 'green',  hex: '#22c55e', label: 'Verde' },
  { key: 'orange', hex: '#f97316', label: 'Naranja' },
  { key: 'red',    hex: '#ef4444', label: 'Rojo' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getEventIcon(type: AgendaEvent['type']) {
  if (type === 'birthday')           return <Cake className="h-3 w-3 flex-shrink-0" />
  if (type === 'installment_overdue') return <AlertTriangle className="h-3 w-3 flex-shrink-0" />
  if (type === 'installment_due')     return <DollarSign className="h-3 w-3 flex-shrink-0" />
  if (type === 'reminder')            return <Bell className="h-3 w-3 flex-shrink-0" />
  if (type === 'scheduled_visit')     return <CalendarCheck className="h-3 w-3 flex-shrink-0" />
  return null
}

function getEventBg(type: AgendaEvent['type']) {
  if (type === 'birthday')            return 'bg-pink-100 text-pink-700 border-pink-200'
  if (type === 'installment_overdue') return 'bg-red-100 text-red-700 border-red-200'
  if (type === 'installment_due')     return 'bg-amber-100 text-amber-700 border-amber-200'
  if (type === 'reminder')            return 'bg-violet-100 text-violet-700 border-violet-200'
  if (type === 'scheduled_visit')     return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function buildCalendarDays(year: number, month: number) {
  const firstDay    = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

// ─── Create Reminder Modal ──────────────────────────────────────────────────────
function CreateReminderModal({
  date, onClose, onCreated,
}: { date: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle]   = useState('')
  const [note, setNote]     = useState('')
  const [color, setColor]   = useState('purple')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!title.trim()) { setError('El título es requerido'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/agenda/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), date, note: note.trim() || null, color }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Error') }
      onCreated(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Bell className="h-4 w-4 text-violet-500" /> Nuevo recordatorio
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha</label>
            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border">{date}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Título *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Llamar a cliente, Reunión con proveedor..."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nota (opcional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Detalles adicionales..."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Color</label>
            <div className="flex gap-2">
              {REMINDER_COLORS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c.key ? 'border-gray-900 scale-110' : 'border-transparent')}
                  style={{ background: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border">Cancelar</button>
          <button
            onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create Visit Modal ─────────────────────────────────────────────────────────
function CreateVisitModal({
  date, onClose, onCreated,
}: { date: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle]             = useState('Visita de cobranza')
  const [visitType, setVisitType]     = useState('Cobranza')
  const [note, setNote]               = useState('')
  const [search, setSearch]           = useState('')
  const [searchResults, setSearchResults] = useState<ClientOption[]>([])
  const [selectedClients, setSelectedClients] = useState<ClientOption[]>([])
  const [searching, setSearching]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(search)}&limit=8`)
        const j   = await res.json()
        const list: ClientOption[] = (j.data || j.clients || []).map((c: any) => ({
          id: c.id, name: c.name, phone: c.phone, credit_used: c.credit_used || 0,
        }))
        setSearchResults(list.filter(c => !selectedClients.find(s => s.id === c.id)))
      } catch {}
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, selectedClients])

  function toggleClient(c: ClientOption) {
    setSelectedClients(prev =>
      prev.find(s => s.id === c.id) ? prev.filter(s => s.id !== c.id) : [...prev, c]
    )
    setSearchResults(prev => prev.filter(s => s.id !== c.id))
    setSearch('')
  }

  async function handleSave() {
    if (selectedClients.length === 0) { setError('Selecciona al menos un cliente'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/agenda/scheduled-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Visita de cobranza',
          scheduled_date: date,
          visit_type: visitType,
          note: note.trim() || null,
          client_ids: selectedClients.map(c => c.id),
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Error') }
      onCreated(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <CalendarCheck className="h-4 w-4 text-indigo-500" /> Programar visita
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha</label>
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border">{date}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
              <select
                value={visitType} onChange={e => setVisitType(e.target.value)}
                className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {['Cobranza','Activación','Seguimiento','Prospección'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Título</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Client search */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Clientes a visitar *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente por nombre o DNI..."
                className="w-full pl-8 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {searching && <Loader2 className="absolute right-3 top-2.5 h-3.5 w-3.5 animate-spin text-gray-400" />}
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-lg mt-1 divide-y max-h-36 overflow-y-auto bg-white shadow-md">
                {searchResults.map(c => (
                  <button
                    key={c.id} onClick={() => toggleClient(c)}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.phone}</div>
                    </div>
                    {c.credit_used > 0 && (
                      <span className="text-xs text-red-600 font-medium">S/ {c.credit_used.toFixed(0)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected clients */}
          {selectedClients.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">{selectedClients.length} cliente{selectedClients.length !== 1 ? 's' : ''} seleccionado{selectedClients.length !== 1 ? 's' : ''}</div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {selectedClients.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm">
                    <div>
                      <span className="font-medium text-indigo-900">{c.name}</span>
                      {c.credit_used > 0 && <span className="text-xs text-indigo-600 ml-2">S/ {c.credit_used.toFixed(0)}</span>}
                    </div>
                    <button onClick={() => setSelectedClients(prev => prev.filter(s => s.id !== c.id))} className="text-indigo-400 hover:text-indigo-700 ml-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nota (opcional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Observaciones de la visita..."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border">Cancelar</button>
          <button
            onClick={handleSave} disabled={saving || selectedClients.length === 0}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
            Programar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Day Action Menu ────────────────────────────────────────────────────────────
function DayActionMenu({
  date, onReminder, onVisit, onClose,
}: { date: string; onReminder: () => void; onVisit: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-64 p-2" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{date}</div>
        <button
          onClick={() => { onClose(); onReminder() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-violet-50 text-sm text-left transition-colors"
        >
          <div className="p-1.5 bg-violet-100 rounded-lg"><Bell className="h-4 w-4 text-violet-600" /></div>
          <div>
            <div className="font-medium text-gray-900">Recordatorio</div>
            <div className="text-xs text-gray-400">Nota personal para este día</div>
          </div>
        </button>
        <button
          onClick={() => { onClose(); onVisit() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 text-sm text-left transition-colors"
        >
          <div className="p-1.5 bg-indigo-100 rounded-lg"><CalendarCheck className="h-4 w-4 text-indigo-600" /></div>
          <div>
            <div className="font-medium text-gray-900">Programar visita</div>
            <div className="text-xs text-gray-400">Visita a uno o varios clientes</div>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────────────
function DetailPanel({
  events, date, onClose, onDeleted,
}: { events: AgendaEvent[]; date: string; onClose: () => void; onDeleted: () => void }) {
  const router   = useRouter()
  const [loading, setLoading]         = useState<string | null>(null)
  const [visitClients, setVisitClients] = useState<Record<string, ClientOption[]>>({})

  // Format date label
  const parts = date.split('-')
  const label = `${parseInt(parts[2])} de ${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0]}`

  // Load clients for scheduled visits
  useEffect(() => {
    const visits = events.filter(e => e.type === 'scheduled_visit' && e.client_ids?.length)
    if (visits.length === 0) return
    const allIds = [...new Set(visits.flatMap(v => v.client_ids || []))]
    fetch(`/api/clients/by-ids?ids=${allIds.join(',')}`)
      .then(r => r.json())
      .then(j => {
        const map: Record<string, ClientOption> = {}
        for (const c of (j.data || [])) map[c.id] = c
        const grouped: Record<string, ClientOption[]> = {}
        for (const v of visits) {
          grouped[v.id] = (v.client_ids || []).map((id: string) => map[id]).filter(Boolean)
        }
        setVisitClients(grouped)
      })
  }, [events])

  async function deleteReminder(id: string, reminderId: string) {
    setLoading(id)
    await fetch(`/api/agenda/reminders/${reminderId}`, { method: 'DELETE' })
    setLoading(null); onDeleted(); onClose()
  }

  async function deleteVisit(id: string, visitId: string) {
    setLoading(id)
    await fetch(`/api/agenda/scheduled-visits/${visitId}`, { method: 'DELETE' })
    setLoading(null); onDeleted(); onClose()
  }

  async function completeVisit(id: string, visitId: string) {
    setLoading(id)
    await fetch(`/api/agenda/scheduled-visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    setLoading(null); onDeleted(); onClose()
  }

  function openMapForVisit(ev: AgendaEvent) {
    const ids = (ev.client_ids || []).join(',')
    router.push(`/map?clients=${ids}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-gray-900">{label}</div>
            <div className="text-xs text-gray-500">{events.length} evento{events.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {events.map(ev => (
            <div key={ev.id} className={cn('rounded-xl border p-3 space-y-2', getEventBg(ev.type))}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  {getEventIcon(ev.type)}
                  {ev.title}
                  {ev.status === 'completed' && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {/* Reminder actions */}
                  {ev.type === 'reminder' && ev.reminder_id && (
                    <button
                      onClick={() => deleteReminder(ev.id, ev.reminder_id!)}
                      disabled={loading === ev.id}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                      title="Eliminar recordatorio"
                    >
                      {loading === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {/* Visit actions */}
                  {ev.type === 'scheduled_visit' && ev.visit_id && ev.status !== 'completed' && (
                    <>
                      <button
                        onClick={() => completeVisit(ev.id, ev.visit_id!)}
                        disabled={loading === ev.id}
                        className="p-1 hover:bg-green-100 rounded text-green-600"
                        title="Marcar como completada"
                      >
                        {loading === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteVisit(ev.id, ev.visit_id!)}
                        disabled={loading === ev.id}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                        title="Cancelar visita"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Subtitle */}
              {ev.subtitle && <div className="text-xs opacity-80">{ev.subtitle}</div>}

              {/* Nota de visita programada */}
              {ev.type === 'scheduled_visit' && ev.note && (
                <div className="text-xs italic text-indigo-700 bg-indigo-50 rounded px-2 py-1 mt-1">
                  📝 {ev.note}
                </div>
              )}

              {/* Visit: client list + map button */}
              {ev.type === 'scheduled_visit' && (
                <div className="space-y-2">
                  {(visitClients[ev.id] || []).map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white/60 rounded-lg px-2 py-1.5 text-xs">
                      <div>
                        <div className="font-medium text-indigo-900">{c.name}</div>
                        {c.credit_used > 0 && <div className="text-indigo-600">Deuda: S/ {c.credit_used.toFixed(2)}</div>}
                      </div>
                      {c.phone && (
                        <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1 hover:bg-white rounded text-indigo-500">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                  {/* Ver ruta en mapa */}
                  {(ev.client_ids || []).length > 0 && (
                    <button
                      onClick={() => openMapForVisit(ev)}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Ver ruta en mapa ({(ev.client_ids || []).length} clientes)
                    </button>
                  )}
                </div>
              )}

              {/* Birthday / installment: phone actions */}
              {(ev.type === 'birthday' || ev.type === 'installment_due' || ev.type === 'installment_overdue') && ev.phone && (
                <div className="flex gap-2">
                  <a href={`tel:${ev.phone}`}
                    className="flex items-center gap-1 text-xs bg-white/60 hover:bg-white px-2 py-1 rounded-lg border border-current/20">
                    <Phone className="h-3 w-3" /> Llamar
                  </a>
                  <a href={`https://wa.me/${ev.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-white/60 hover:bg-white px-2 py-1 rounded-lg border border-current/20">
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Event Pill ─────────────────────────────────────────────────────────────────
function EventPill({ event, onClick }: { event: AgendaEvent; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className={cn(
        'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded border flex items-center gap-0.5 truncate font-medium hover:opacity-80 transition-opacity',
        getEventBg(event.type)
      )}
      title={`${event.title} — ${event.subtitle || ''}`}
    >
      {getEventIcon(event.type)}
      <span className="truncate">{event.title}</span>
    </button>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export function AgendaCalendar() {
  const today = new Date()
  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth() + 1)
  const [data, setData]     = useState<AgendaData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [selectedDate, setSelectedDate]     = useState<string | null>(null)
  const [actionDate, setActionDate]         = useState<string | null>(null)
  const [showReminder, setShowReminder]     = useState(false)
  const [showVisit, setShowVisit]           = useState(false)
  const [reminderDate, setReminderDate]     = useState<string | null>(null)
  const [visitDate, setVisitDate]           = useState<string | null>(null)

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agenda/events?year=${y}&month=${m}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error')
      setData(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEvents(year, month) }, [year, month, fetchEvents])

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }

  const calDays    = buildCalendarDays(year, month)
  const todayStr   = getTodayPeru()

  const eventsByDate: Record<string, AgendaEvent[]> = {}
  if (data?.events) {
    for (const ev of data.events) {
      if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []
      eventsByDate[ev.date].push(ev)
    }
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  function handleDayClick(dateStr: string) {
    const dayEvents = eventsByDate[dateStr] || []
    if (dayEvents.length > 0) {
      setSelectedDate(dateStr)
    } else {
      setActionDate(dateStr)
    }
  }

  function handleRefresh() { fetchEvents(year, month) }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Hoy</button>
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* ── Summary pills ───────────────────────────────────── */}
      {data && !loading && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs bg-pink-50 border border-pink-200 text-pink-700 px-3 py-1.5 rounded-full font-medium">
            <Cake className="h-3.5 w-3.5" />{data.summary.birthdays} cumpleaños
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full font-medium">
            <Clock className="h-3.5 w-3.5" />{data.summary.due} cuotas por vencer
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-full font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />{data.summary.overdue} cuotas vencidas
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-violet-50 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-full font-medium">
            <Bell className="h-3.5 w-3.5" />{data.summary.reminders} recordatorios
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium">
            <CalendarCheck className="h-3.5 w-3.5" />{data.summary.visits} visitas prog.
          </span>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 text-gray-500 px-3 py-1.5 rounded-full hover:bg-gray-100 ml-auto"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* ── Hint ────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Plus className="h-3 w-3" /> Haz clic en un día vacío para agregar un recordatorio o programar una visita
      </p>

      {/* ── Calendar ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
          ))}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="min-h-[90px] bg-gray-50/50 border-b border-r border-gray-50" />
              }
              const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayEvents = eventsByDate[dateStr] || []
              const isToday   = dateStr === todayStr
              const MAX_PILLS = 3

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className={cn(
                    'min-h-[90px] p-1.5 border-b border-r border-gray-50 flex flex-col gap-1 cursor-pointer transition-colors',
                    dayEvents.length > 0 ? 'hover:bg-gray-50' : 'hover:bg-indigo-50/30',
                    isToday && 'bg-indigo-50/40'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold self-start',
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    {dayEvents.slice(0, MAX_PILLS).map(ev => (
                      <EventPill key={ev.id} event={ev} onClick={() => setSelectedDate(dateStr)} />
                    ))}
                    {dayEvents.length > MAX_PILLS && (
                      <div className="text-[10px] text-gray-400 px-1 font-medium">+{dayEvents.length - MAX_PILLS} más</div>
                    )}
                  </div>
                  {/* Plus hint on empty hover */}
                  {dayEvents.length === 0 && (
                    <div className="opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center mt-auto pb-1">
                      <Plus className="h-3 w-3 text-indigo-300" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
        {[
          { color: 'bg-pink-200', label: 'Cumpleaños' },
          { color: 'bg-amber-200', label: 'Cuota por vencer' },
          { color: 'bg-red-200', label: 'Cuota vencida' },
          { color: 'bg-violet-200', label: 'Recordatorio' },
          { color: 'bg-indigo-200', label: 'Visita programada' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded inline-block', l.color)} />{l.label}
          </span>
        ))}
      </div>

      {/* ── Events list ─────────────────────────────────────── */}
      {data && data.events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            Lista de eventos del mes
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.events.map(ev => (
              <button
                key={ev.id}
                onClick={() => setSelectedDate(ev.date)}
                className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-xs text-left hover:opacity-90 transition-opacity', getEventBg(ev.type))}
              >
                <div className="flex-shrink-0">{getEventIcon(ev.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{ev.title}</div>
                  <div className="opacity-75 truncate">{ev.subtitle}</div>
                </div>
                <div className="text-right flex-shrink-0 opacity-70">
                  {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
      {actionDate && (
        <DayActionMenu
          date={actionDate}
          onClose={() => setActionDate(null)}
          onReminder={() => { setReminderDate(actionDate); setShowReminder(true) }}
          onVisit={() => { setVisitDate(actionDate); setShowVisit(true) }}
        />
      )}
      {showReminder && reminderDate && (
        <CreateReminderModal
          date={reminderDate}
          onClose={() => { setShowReminder(false); setReminderDate(null) }}
          onCreated={handleRefresh}
        />
      )}
      {showVisit && visitDate && (
        <CreateVisitModal
          date={visitDate}
          onClose={() => { setShowVisit(false); setVisitDate(null) }}
          onCreated={handleRefresh}
        />
      )}
      {selectedDate && selectedEvents.length > 0 && (
        <DetailPanel
          events={selectedEvents}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          onDeleted={handleRefresh}
        />
      )}
    </div>
  )
}
