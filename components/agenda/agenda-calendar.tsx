'use client'

/**
 * AgendaCalendar — Calendario de eventos del negocio
 * Muestra: Cumpleaños de clientes, cuotas por vencer, cuotas vencidas
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Cake, AlertTriangle,
  DollarSign, Phone, MessageCircle, Loader2, CalendarDays,
  Users, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AgendaEvent {
  id: string
  type: 'birthday' | 'installment_due' | 'installment_overdue'
  date: string
  title: string
  subtitle?: string
  client_id?: string
  client_name?: string
  amount?: number
  phone?: string
  color: string
}

interface AgendaData {
  year: number
  month: number
  events: AgendaEvent[]
  summary: { birthdays: number; due: number; overdue: number }
}

// ─── Constants ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getEventIcon(type: AgendaEvent['type']) {
  if (type === 'birthday') return <Cake className="h-3 w-3" />
  if (type === 'installment_overdue') return <AlertTriangle className="h-3 w-3" />
  return <DollarSign className="h-3 w-3" />
}

function getEventBg(type: AgendaEvent['type']) {
  if (type === 'birthday') return 'bg-pink-100 text-pink-700 border-pink-200'
  if (type === 'installment_overdue') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  // Pad to complete last week
  while (days.length % 7 !== 0) days.push(null)
  return days
}

// ─── Event Pill ────────────────────────────────────────────────────────────────
function EventPill({ event, onClick }: { event: AgendaEvent; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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

// ─── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  events, date, onClose,
}: {
  events: AgendaEvent[]
  date: string
  onClose: () => void
}) {
  const router = useRouter()
  const [d, m, y] = date.split('-').reverse().map(Number)
  const label = `${d} de ${MONTH_NAMES[m - 1]} ${y}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="text-sm font-semibold text-gray-900">{label}</div>
            <div className="text-xs text-gray-500">{events.length} evento{events.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        {/* Events list */}
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {events.map(ev => (
            <div key={ev.id} className={cn('rounded-xl border p-3', getEventBg(ev.type))}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    {getEventIcon(ev.type)}
                    {ev.title}
                  </div>
                  {ev.subtitle && (
                    <div className="text-xs mt-0.5 opacity-80">{ev.subtitle}</div>
                  )}
                </div>
                {ev.client_id && (
                  <button
                    onClick={() => { onClose(); router.push(`/clients?filter=birthday`) }}
                    className="text-xs underline opacity-70 hover:opacity-100 flex-shrink-0"
                  >
                    Ver
                  </button>
                )}
              </div>
              {ev.phone && (
                <div className="flex gap-2 mt-2">
                  <a
                    href={`tel:${ev.phone}`}
                    className="flex items-center gap-1 text-xs bg-white/60 hover:bg-white px-2 py-1 rounded-lg border border-current/20 transition-colors"
                  >
                    <Phone className="h-3 w-3" /> Llamar
                  </a>
                  <a
                    href={`https://wa.me/${ev.phone?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-white/60 hover:bg-white px-2 py-1 rounded-lg border border-current/20 transition-colors"
                  >
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

// ─── Main Component ─────────────────────────────────────────────────────────────
export function AgendaCalendar() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData]   = useState<AgendaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agenda/events?year=${y}&month=${m}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar agenda')
      setData(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents(year, month) }, [year, month, fetchEvents])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }

  const calDays = buildCalendarDays(year, month)
  const todayStr = today.toISOString().split('T')[0]

  // Group events by date
  const eventsByDate: Record<string, AgendaEvent[]> = {}
  if (data?.events) {
    for (const ev of data.events) {
      if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []
      eventsByDate[ev.date].push(ev)
    }
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            Hoy
          </button>
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[130px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Summary pills ───────────────────────────────────────────── */}
      {data && !loading && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs bg-pink-50 border border-pink-200 text-pink-700 px-3 py-1.5 rounded-full font-medium">
            <Cake className="h-3.5 w-3.5" />
            {data.summary.birthdays} cumpleaños
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full font-medium">
            <Clock className="h-3.5 w-3.5" />
            {data.summary.due} cuotas por vencer
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-full font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {data.summary.overdue} cuotas vencidas
          </span>
        </div>
      )}

      {/* ── Calendar grid ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
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
              const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayEvents = eventsByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const hasEvents = dayEvents.length > 0
              const MAX_PILLS = 3

              return (
                <div
                  key={dateStr}
                  onClick={() => hasEvents && setSelectedDate(dateStr)}
                  className={cn(
                    'min-h-[90px] p-1.5 border-b border-r border-gray-50 flex flex-col gap-1 transition-colors',
                    hasEvents && 'cursor-pointer hover:bg-gray-50',
                    isToday && 'bg-indigo-50/40'
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold self-start',
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                  )}>
                    {day}
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5 flex-1">
                    {dayEvents.slice(0, MAX_PILLS).map(ev => (
                      <EventPill
                        key={ev.id}
                        event={ev}
                        onClick={() => setSelectedDate(dateStr)}
                      />
                    ))}
                    {dayEvents.length > MAX_PILLS && (
                      <div className="text-[10px] text-gray-400 px-1 font-medium">
                        +{dayEvents.length - MAX_PILLS} más
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-pink-200 inline-block" /> Cumpleaños
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-200 inline-block" /> Cuota por vencer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-200 inline-block" /> Cuota vencida
        </span>
      </div>

      {/* ── Side list: upcoming events ─────────────────────────────── */}
      {data && data.events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            Lista de eventos del mes
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.events.map(ev => (
              <div key={ev.id} className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl border text-xs',
                getEventBg(ev.type)
              )}>
                <div className="flex-shrink-0">{getEventIcon(ev.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{ev.title}</div>
                  <div className="opacity-75">{ev.subtitle}</div>
                </div>
                <div className="text-right flex-shrink-0 opacity-70">
                  {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'short'
                  })}
                </div>
                {ev.phone && (
                  <a
                    href={`https://wa.me/${ev.phone.replace(/\D/g,'')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-shrink-0 bg-white/50 hover:bg-white p-1 rounded-lg border border-current/20"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Detail modal ───────────────────────────────────────────── */}
      {selectedDate && selectedEvents.length > 0 && (
        <DetailPanel
          events={selectedEvents}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
