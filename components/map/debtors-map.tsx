'use client'

/**
 * Debtors Map Component
 * 
 * Mapa de Google Maps mostrando clientes según filtro seleccionado
 * Filtros: Atrasados, Próximos a Vencer, Al Día, Todos con Crédito
 * 
 * Design tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Button height: 36px
 * - Spacing: 16px
 */

import { useEffect, useState, useCallback } from 'react'
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'
import { Navigation, Loader2, ListChecks, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { VisitPanel, type VisitEntry } from './visit-panel'

type FilterType = 'overdue' | 'upcoming' | 'up-to-date' | 'all' | 'activation'
type RouteType = 'Cobranza' | 'Activación' | 'Seguimiento' | 'Prospección'

interface Client {
  id: string
  name: string
  phone: string
  address: string
  lat: number
  lng: number
  credit_used: number
  credit_limit: number
  overdue_amount?: number
  overdue_count?: number
  upcoming_amount?: number
  upcoming_count?: number
  next_due_date?: string
  payment_count?: number
  status?: string
}

const mapContainerStyle = {
  width: '100%',
  height: '600px'
}

// Centro de Trujillo, Perú
const center = {
  lat: -8.1116,
  lng: -79.0288
}

const filterConfig = {
  overdue: {
    label: 'Atrasados',
    api: '/api/clients/with-overdue',
    color: 'red',
    description: 'Clientes con pagos vencidos'
  },
  upcoming: {
    label: 'Próximos a Vencer',
    api: '/api/clients/with-upcoming',
    color: 'yellow',
    description: 'Clientes con cuotas en los próximos 7 días'
  },
  'up-to-date': {
    label: 'Al Día',
    api: '/api/clients/up-to-date',
    color: 'green',
    description: 'Mejores clientes - sin atrasos'
  },
  all: {
    label: 'Todos con Crédito',
    api: '/api/clients/with-debt',
    color: 'blue',
    description: 'Todos los clientes con crédito activo'
  },
  activation: {
    label: 'Activación',
    api: '/api/clients/all',
    color: 'purple',
    description: 'Todos los clientes activos — para visitas de activación o prospección'
  }
}

// ── Haversine distance (km) ────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Nearest-neighbor TSP approximation ────────────────────────────────────────
function optimizeRoute(origin: { lat: number; lng: number }, clients: Client[], maxStops = 9): Client[] {
  const valid = clients.filter(c => c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng))
  const remaining = [...valid]
  const route: Client[] = []
  let current = origin

  while (remaining.length > 0 && route.length < maxStops) {
    let minDist = Infinity
    let nearestIdx = 0
    remaining.forEach((c, i) => {
      const d = haversine(current.lat, current.lng, c.lat, c.lng)
      if (d < minDist) { minDist = d; nearestIdx = i }
    })
    const nearest = remaining[nearestIdx]
    route.push(nearest)
    remaining.splice(nearestIdx, 1)
    current = { lat: nearest.lat, lng: nearest.lng }
  }
  return route
}

const MAX_ROUTE_STOPS = 9 // Google Maps URL limit (~10 stops including origin)

const ROUTE_TYPES: RouteType[] = ['Cobranza', 'Activación', 'Seguimiento', 'Prospección']
const DAYS_FILTERS = [
  { label: 'Todos',   value: 0   },
  { label: '+15 días', value: 15 },
  { label: '+30 días', value: 30 },
  { label: '+60 días', value: 60 },
  { label: '+90 días', value: 90 },
]

export function DebtorsMap() {
  const [filter, setFilter] = useState<FilterType>('overdue')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingRoute, setGeneratingRoute] = useState(false)
  const [routeType, setRouteType] = useState<RouteType>('Cobranza')

  // Visit panel state
  const [selectionMode, setSelectionMode] = useState(false)
  const [visitEntries, setVisitEntries]   = useState<VisitEntry[]>([])
  const [panelOpen, setPanelOpen]         = useState(false)

  // Days overdue filter (only for 'overdue' filter)
  const [minDays, setMinDays] = useState(0)

  // Load Google Maps API
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    preventGoogleFontsLoading: true,
  })

  useEffect(() => {
    loadClients(filter)
  }, [filter])

  const loadClients = async (filterType: FilterType) => {
    setLoading(true)
    try {
      const response = await fetch(filterConfig[filterType].api)
      const { data } = await response.json()
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtered clients (apply days filter for overdue) ───────────────────────
  const displayedClients = filter === 'overdue' && minDays > 0
    ? clients.filter(c => ((c as any).max_days_overdue ?? 0) >= minDays)
    : clients

  // ── Selection mode handlers ────────────────────────────────────────────────
  const handleMarkerClick = useCallback((client: Client) => {
    if (!selectionMode) {
      setSelectedClient(client)
      return
    }
    // Toggle client in visit list
    setVisitEntries(prev => {
      const exists = prev.find(e => e.client.id === client.id)
      if (exists) return prev.filter(e => e.client.id !== client.id)
      return [...prev, { client: client as any }]
    })
    setPanelOpen(true)
  }, [selectionMode])

  const isSelected = (clientId: string) =>
    visitEntries.some(e => e.client.id === clientId)

  // ── Route optimization ─────────────────────────────────────────────────────
  const handleGenerateRoute = () => {
    // Use visit panel list if populated, otherwise all displayed clients
    const sourceClients = visitEntries.length > 0
      ? visitEntries.map(e => e.client as unknown as Client)
      : displayedClients
    const validClients = sourceClients.filter(c => c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng))
    if (validClients.length === 0) {
      toast.error('Sin datos', 'Ningún cliente del filtro actual tiene coordenadas GPS.')
      return
    }

    if (!navigator.geolocation) {
      toast.error('GPS no disponible', 'Este navegador no soporta geolocalización.')
      return
    }

    setGeneratingRoute(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const route = optimizeRoute(origin, validClients, MAX_ROUTE_STOPS)

        // Build Google Maps multi-stop URL with route type label
        const stops = [
          `${origin.lat},${origin.lng}`,
          ...route.map(c => `${c.lat},${c.lng}`)
        ]
        const mapsUrl = `https://www.google.com/maps/dir/${stops.join('/')}`

        window.open(mapsUrl, '_blank')
        setGeneratingRoute(false)

        const total = validClients.length
        const shown = route.length
        toast.success(
          `Ruta de ${routeType} generada`,
          `${shown} de ${total} parada${total !== 1 ? 's' : ''} optimizadas por distancia`
        )
      },
      (err) => {
        setGeneratingRoute(false)
        const msg = err.code === 1
          ? 'Permiso de ubicación denegado. Activa el GPS en tu navegador.'
          : 'No se pudo obtener la ubicación del dispositivo.'
        toast.error('Error de GPS', msg)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    )
  }

  // Determinar color del marcador según filtro
  const getMarkerColor = (client: Client) => {
    if (filter === 'overdue') {
      const overdueAmount = client.overdue_amount || 0
      if (overdueAmount >= 500) return '#EF4444' // red-500
      if (overdueAmount >= 300) return '#F97316' // orange-500
      if (overdueAmount >= 100) return '#EAB308' // yellow-500
      return '#22C55E' // green-500
    }
    
    if (filter === 'upcoming') {
      const upcomingAmount = client.upcoming_amount || 0
      if (upcomingAmount >= 300) return '#F97316' // orange-500
      if (upcomingAmount >= 150) return '#EAB308' // yellow-500
      return '#22C55E' // green-500
    }
    
    if (filter === 'up-to-date') {
      return '#22C55E' // green-500
    }
    
    // activation - por calificación del cliente
    if (filter === 'activation') {
      const rating = (client as any).rating || 'C'
      if (rating === 'A') return '#8B5CF6' // violet-500
      if (rating === 'B') return '#A78BFA' // violet-400
      if (rating === 'C') return '#C4B5FD' // violet-300
      return '#DDD6FE'                      // violet-200
    }

    // all - por nivel de uso de crédito
    const usage = (client.credit_used / client.credit_limit) * 100
    if (usage >= 80) return '#EF4444' // red-500
    if (usage >= 60) return '#F97316' // orange-500
    if (usage >= 40) return '#EAB308' // yellow-500
    return '#3B82F6' // blue-500
  }

  // Crear ícono de ubicación (pin) personalizado con color
  const createLocationIcon = (color: string) => {
    // Usar el ícono de marcador predeterminado de Google Maps con color personalizado
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
          <path fill="${color}" stroke="#FFFFFF" stroke-width="2" d="M16 0C9.373 0 4 5.373 4 12c0 8.5 12 26 12 26s12-17.5 12-26c0-6.627-5.373-12-12-12z"/>
          <circle cx="16" cy="12" r="5" fill="#FFFFFF"/>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(32, 42),
      anchor: new google.maps.Point(16, 42),
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (loadError) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">
          Error al cargar Google Maps
        </p>
      </Card>
    )
  }

  if (!apiKey) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">
          Error: Google Maps API key no configurada
        </p>
      </Card>
    )
  }

  if (!isLoaded || loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-600">Cargando mapa...</p>
      </Card>
    )
  }

  const currentFilter = filterConfig[filter]

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(filterConfig) as FilterType[]).map((key) => (
            <Button
              key={key}
              variant={filter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilter(key); setMinDays(0) }}
              className="gap-2"
            >
              <div className={`w-3 h-3 rounded-full bg-${filterConfig[key].color}-500`}></div>
              {filterConfig[key].label}
              {filter === key && (
                <Badge variant="secondary" className="ml-1">
                  {displayedClients.length}
                </Badge>
              )}
            </Button>
          ))}

          {/* Right-side controls */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Selection mode toggle */}
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode)
                if (!selectionMode) setPanelOpen(true)
              }}
              className={`gap-2 ${selectionMode ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
              title="Seleccionar clientes para visitar"
            >
              <ListChecks className="h-3.5 w-3.5" />
              {selectionMode ? 'Seleccionando…' : 'Seleccionar'}
              {visitEntries.length > 0 && (
                <Badge variant="secondary" className="ml-0.5">{visitEntries.length}</Badge>
              )}
            </Button>

            {/* Open panel button if has entries but panel is closed */}
            {visitEntries.length > 0 && !panelOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPanelOpen(true)}
                className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Ver lista ({visitEntries.length})
              </Button>
            )}

            {/* Route type selector */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">Tipo:</label>
              <select
                value={routeType}
                onChange={e => setRouteType(e.target.value as RouteType)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {ROUTE_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>

            {/* Generate route button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateRoute}
              disabled={generatingRoute || displayedClients.length === 0 || loading}
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              title={`Generar ruta de ${routeType} (máx. ${MAX_ROUTE_STOPS} paradas)`}
            >
              {generatingRoute
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> GPS…</>
                : <><Navigation className="h-3.5 w-3.5" /> Generar Ruta</>
              }
            </Button>
          </div>
        </div>

        {/* Days-overdue sub-filter (only for 'overdue') */}
        {filter === 'overdue' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Días de atraso:</span>
            <div className="flex gap-1 flex-wrap">
              {DAYS_FILTERS.map(df => (
                <button
                  key={df.value}
                  onClick={() => setMinDays(df.value)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    minDays === df.value
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>
            {minDays > 0 && (
              <span className="text-xs text-red-600 font-medium">
                {displayedClients.length} cliente{displayedClients.length !== 1 ? 's' : ''} con +{minDays} días
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          {selectionMode
            ? '✅ Modo selección activo — haz clic en los marcadores del mapa para agregarlos a tu lista de visitas'
            : currentFilter.description
          }
          {!selectionMode && displayedClients.length > MAX_ROUTE_STOPS && (
            <span className="ml-1 text-amber-600">
              · La ruta incluirá las {MAX_ROUTE_STOPS} paradas más cercanas de {displayedClients.length} clientes
            </span>
          )}
        </p>
      </Card>

      {/* Leyenda */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">
          {currentFilter.label}
        </h3>
        <div className="flex gap-4 text-sm flex-wrap">
          {filter === 'overdue' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Bajo (&lt;S/ 100)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Medio (S/ 100-300)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>Alto (S/ 300-500)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Crítico (&gt;S/ 500)</span>
              </div>
            </>
          )}
          {filter === 'upcoming' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Bajo (&lt;S/ 150)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Medio (S/ 150-300)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>Alto (&gt;S/ 300)</span>
              </div>
            </>
          )}
          {filter === 'up-to-date' && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Clientes al día - Sin atrasos</span>
            </div>
          )}
          {filter === 'all' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Bajo (&lt;40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Medio (40-60%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>Alto (60-80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Crítico (&gt;80%)</span>
              </div>
            </>
          )}
          {filter === 'activation' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                <span>Calificación A</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-400"></div>
                <span>Calificación B</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-300"></div>
                <span>Calificación C / D</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Mapa */}
      <Card className="p-0 overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={12}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {displayedClients.map((client) => {
            const selected = isSelected(client.id)
            // Selected marker: bright green checkmark override
            const iconColor = selected ? '#10B981' : getMarkerColor(client)
            return (
              <Marker
                key={client.id}
                position={{ lat: client.lat, lng: client.lng }}
                onClick={() => handleMarkerClick(client)}
                icon={createLocationIcon(iconColor)}
                zIndex={selected ? 10 : 1}
              />
            )
          })}

          {selectedClient && !selectionMode && (
            <InfoWindow
              position={{ lat: selectedClient.lat, lng: selectedClient.lng }}
              onCloseClick={() => setSelectedClient(null)}
            >
              <div className="p-2" style={{ minWidth: '200px' }}>
                <h3 className="font-bold text-sm text-gray-900 mb-2">{selectedClient.name}</h3>

                <div className="space-y-1 text-xs text-gray-600 mb-2">
                  <p className="flex items-start gap-1">
                    <span>📍</span>
                    <span>{selectedClient.address}</span>
                  </p>
                  <p>📞 {selectedClient.phone}</p>
                  {(selectedClient as any).max_days_overdue > 0 && (
                    <p className="text-red-600 font-semibold">
                      ⏰ {(selectedClient as any).max_days_overdue} días de atraso
                    </p>
                  )}
                </div>

                <div className="border-t pt-2 mb-2">
                  {filter === 'overdue' && (
                    <div className="text-sm">
                      <p className="text-gray-600 text-xs">Monto Atrasado</p>
                      <p className="font-bold text-red-600">{formatCurrency(selectedClient.overdue_amount || 0)}</p>
                    </div>
                  )}
                  {filter === 'upcoming' && (
                    <div className="text-sm">
                      <p className="text-gray-600 text-xs">Próximo Pago</p>
                      <p className="font-bold text-yellow-600">{formatCurrency(selectedClient.upcoming_amount || 0)}</p>
                    </div>
                  )}
                  {filter === 'up-to-date' && (
                    <div className="text-sm">
                      <p className="text-green-600 font-semibold">✓ Al día</p>
                    </div>
                  )}
                  {(filter === 'all' || filter === 'activation') && (
                    <div className="text-sm">
                      <p className="text-gray-600 text-xs">Crédito usado</p>
                      <p className="font-bold">{formatCurrency(selectedClient.credit_used)}</p>
                    </div>
                  )}
                </div>

                {/* Add to visit list button */}
                <button
                  onClick={() => {
                    setVisitEntries(prev => {
                      if (prev.find(e => e.client.id === selectedClient.id)) return prev
                      return [...prev, { client: selectedClient as any }]
                    })
                    setPanelOpen(true)
                    setSelectedClient(null)
                  }}
                  className="w-full text-xs bg-emerald-600 text-white rounded px-2 py-1.5 hover:bg-emerald-700 transition-colors font-medium"
                >
                  + Agregar a lista de visitas
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {filter === 'overdue' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Clientes con Atraso</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Monto Atrasado</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(clients.reduce((sum, c) => sum + (c.overdue_amount || 0), 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Cuotas Vencidas</p>
              <p className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + (c.overdue_count || 0), 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
          </>
        )}
        {filter === 'upcoming' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Clientes</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Monto Próximo</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(clients.reduce((sum, c) => sum + (c.upcoming_amount || 0), 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Cuotas Próximas</p>
              <p className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + (c.upcoming_count || 0), 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
          </>
        )}
        {filter === 'up-to-date' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Clientes al Día</p>
              <p className="text-2xl font-bold text-green-600">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Pagos Realizados</p>
              <p className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + (c.payment_count || 0), 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Límite Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_limit, 0))}
              </p>
            </Card>
          </>
        )}
        {filter === 'all' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Total Clientes</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Límite Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_limit, 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Uso Promedio</p>
              <p className="text-2xl font-bold">
                {clients.length > 0
                  ? ((clients.reduce((sum, c) => sum + (c.credit_used / c.credit_limit) * 100, 0) / clients.length)).toFixed(1)
                  : 0}%
              </p>
            </Card>
          </>
        )}
        {filter === 'activation' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Total Clientes</p>
              <p className="text-2xl font-bold text-violet-600">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Con Crédito Activo</p>
              <p className="text-2xl font-bold">
                {clients.filter(c => c.credit_limit > 0).length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Sin Crédito Asignado</p>
              <p className="text-2xl font-bold text-amber-600">
                {clients.filter(c => c.credit_limit === 0).length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600">Paradas en Ruta</p>
              <p className="text-2xl font-bold">
                {Math.min(clients.length, MAX_ROUTE_STOPS)}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Visit panel (right drawer) */}
      <VisitPanel
        entries={visitEntries}
        visitType={routeType}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onRemove={clientId =>
          setVisitEntries(prev => prev.filter(e => e.client.id !== clientId))
        }
        onClearAll={() => {
          setVisitEntries([])
          setSelectionMode(false)
          setPanelOpen(false)
        }}
        onGenerateRoute={handleGenerateRoute}
        generatingRoute={generatingRoute}
      />
    </div>
  )
}
