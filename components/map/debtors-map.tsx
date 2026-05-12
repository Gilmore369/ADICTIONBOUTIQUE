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
import { useSearchParams } from 'next/navigation'
import { GoogleMap, useLoadScript, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'
import { Navigation, Loader2, ListChecks, X, CalendarDays } from 'lucide-react'
import { toast } from '@/lib/toast'
import { VisitPanel, type VisitEntry } from './visit-panel'
import { useStore } from '@/contexts/store-context'
import { formatDatePeru } from '@/lib/utils/timezone'

type FilterType = 'overdue' | 'upcoming' | 'up-to-date' | 'all'
type RouteType = 'Cobranza' | 'Delivery'

interface Client {
  id: string
  name: string
  phone: string
  address: string
  lat: number | null
  lng: number | null
  credit_used: number
  credit_limit: number
  client_photo_url?: string
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

// Colores fijos para cada filtro (no dependen de Tailwind JIT)
const FILTER_HEX: Record<FilterType, string> = {
  overdue:      '#EF4444', // rojo — se intensifica por días
  upcoming:     '#D97706', // mostaza/ámbar
  'up-to-date': '#16A34A', // verde
  all:          '#2563EB', // azul
}

const filterConfig: Record<FilterType, { label: string; api: string; hex: string; description: string }> = {
  overdue: {
    label: 'Atrasados',
    api: '/api/clients/with-overdue',
    hex: FILTER_HEX.overdue,
    description: 'Clientes con cuotas vencidas — rojo leve < 90 días · rojo intenso ≥ 90 días'
  },
  upcoming: {
    label: 'Próximos a Vencer',
    api: '/api/clients/with-upcoming',
    hex: FILTER_HEX.upcoming,
    description: 'Clientes con cuotas que vencen en los próximos 7 días'
  },
  'up-to-date': {
    label: 'Al Día',
    api: '/api/clients/up-to-date',
    hex: FILTER_HEX['up-to-date'],
    description: 'Clientes al corriente — sin ningún atraso'
  },
  all: {
    label: 'Todos con Crédito',
    api: '/api/clients/with-debt',
    hex: FILTER_HEX.all,
    description: 'Todos los clientes con crédito activo'
  },
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

function hasCoordinates(client: Client): client is Client & { lat: number; lng: number } {
  return Number.isFinite(Number(client.lat)) && Number.isFinite(Number(client.lng))
}

// ── Nearest-neighbor TSP approximation ────────────────────────────────────────
function optimizeRoute(origin: { lat: number; lng: number }, clients: Client[], maxStops = 9): Client[] {
  const valid = clients.filter(hasCoordinates)
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

const MAX_ROUTE_STOPS = 20 // Google Maps supports up to ~25 waypoints in URL
const MAPS_LIBRARIES: ['places'] = ['places']

const ROUTE_TYPES: RouteType[] = ['Cobranza', 'Delivery']
// Para atrasados: toggle entre ver todos o solo los críticos (≥ 90 días)
const OVERDUE_90_THRESHOLD = 90

export function DebtorsMap() {
  const searchParams = useSearchParams()
  const visitClientIds = searchParams.get('clients') // comma-separated UUIDs from Agenda
  const { selectedStore } = useStore()

  const [filter, setFilter] = useState<FilterType>('overdue')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingRoute, setGeneratingRoute] = useState(false)
  const [routeType, setRouteType] = useState<RouteType>('Cobranza')
  const [visitBannerDismissed, setVisitBannerDismissed] = useState(false)

  // Visit panel state
  const MAP_VISITS_KEY = 'boutique_map_visits'
  const [selectionMode, setSelectionMode] = useState(false)
  const [visitEntries, setVisitEntries]   = useState<VisitEntry[]>([])
  const [panelOpen, setPanelOpen]         = useState(false)

  // In-map route state
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null)
  const [routeActive, setRouteActive] = useState(false)

  // Load persisted visit checklist on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MAP_VISITS_KEY)
      if (!saved) return
      const entries: VisitEntry[] = JSON.parse(saved)
      if (Array.isArray(entries) && entries.length > 0) {
        setVisitEntries(entries)
        setPanelOpen(true)
      }
    } catch { /* ignore */ }
  }, [])

  // Persist visit checklist whenever it changes
  useEffect(() => {
    try {
      if (visitEntries.length > 0) {
        localStorage.setItem(MAP_VISITS_KEY, JSON.stringify(visitEntries))
      } else {
        localStorage.removeItem(MAP_VISITS_KEY)
      }
    } catch { /* ignore */ }
  }, [visitEntries])

  // Days overdue filter (only for 'overdue' filter)
  const [minDays, setMinDays] = useState(0)

  // Load Google Maps API (libraries must be stable — defined outside component)
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: MAPS_LIBRARIES,
    preventGoogleFontsLoading: true,
  })

  // If coming from Agenda with specific client IDs, load those directly
  // Reload when filter OR selected store changes
  useEffect(() => {
    setDirectionsResult(null)
    setRouteActive(false)
    if (visitClientIds) {
      loadClientsByIds(visitClientIds)
    } else {
      loadClients(filter)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, visitClientIds, selectedStore])

  const loadClientsByIds = async (ids: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/clients/by-ids?ids=${ids}`)
      const { data } = await response.json()
      setClients(data || [])
      // Auto-add to visit panel
      if (data && data.length > 0) {
        setVisitEntries(data.map((c: Client) => ({ client: c as any })))
        setPanelOpen(true)
      }
    } catch (error) {
      console.error('Error loading clients by ids:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClients = async (filterType: FilterType) => {
    setLoading(true)
    try {
      // Pasar tienda seleccionada para que la API filtre correctamente
      const storeParam = selectedStore && selectedStore !== 'ALL' ? `?store=${selectedStore}` : ''
      const response = await fetch(filterConfig[filterType].api + storeParam)
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
  // pendingEntries = visit list minus already-completed stops
  const pendingEntries = visitEntries.filter(e => !e.visitedResult)

  const handleGenerateRoute = (pendingOnly = false) => {
    let sourceClients: Client[]
    if (visitEntries.length > 0) {
      const pool = pendingOnly ? pendingEntries : visitEntries
      sourceClients = pool.map(e => e.client as unknown as Client)
    } else {
      sourceClients = displayedClients
    }

    const validClients = sourceClients.filter(hasCoordinates)
    if (validClients.length === 0) {
      toast.error('Sin datos', 'Todos los clientes ya fueron visitados o no tienen GPS.')
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

        if (route.length === 0) {
          setGeneratingRoute(false)
          toast.error('Sin paradas', 'No hay paradas con coordenadas válidas.')
          return
        }

        // Build Directions request
        const destination = route[route.length - 1]
        const waypoints = route.slice(0, -1).map(c => ({
          location: new google.maps.LatLng(c.lat, c.lng),
          stopover: true,
        }))

        const directionsService = new google.maps.DirectionsService()
        directionsService.route(
          {
            origin: new google.maps.LatLng(origin.lat, origin.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false, // already optimized by nearest-neighbor
          },
          (result, status) => {
            setGeneratingRoute(false)
            if (status === 'OK' && result) {
              setDirectionsResult(result)
              setRouteActive(true)
              toast.success(
                `Ruta de ${routeType} en mapa`,
                `${route.length} parada${route.length !== 1 ? 's' : ''} optimizadas · usa el panel para navegar`
              )
            } else {
              // Fallback: open in Maps if Directions API fails
              const stops = [
                `${origin.lat},${origin.lng}`,
                ...route.map(c => `${c.lat},${c.lng}`),
              ]
              window.open(`https://www.google.com/maps/dir/${stops.join('/')}`, '_blank')
              toast.info('Ruta en Google Maps', `Directions API no disponible — abierta en pestaña nueva`)
            }
          }
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

  const handleClearRoute = () => {
    setDirectionsResult(null)
    setRouteActive(false)
  }

  // ── Color del pin según filtro activo ─────────────────────────────────────
  // Atrasados: rojo leve (< 90 días) / rojo intenso (≥ 90 días)
  // Próximos:  mostaza uniforme
  // Al día:    verde uniforme
  // Todos:     azul uniforme
  const getMarkerColor = (client: Client): string => {
    switch (filter) {
      case 'overdue': {
        const days = (client as any).max_days_overdue ?? 0
        return days >= 90
          ? '#991B1B'  // rojo intenso — crítico (≥ 90 días)
          : '#EF4444'  // rojo leve    — atraso reciente (< 90 días)
      }
      case 'upcoming':
        return '#D97706'  // mostaza
      case 'up-to-date':
        return '#16A34A'  // verde
      case 'all':
      default:
        return '#2563EB'  // azul
    }
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
        <p className="text-sm text-muted-foreground">Cargando mapa...</p>
      </Card>
    )
  }

  const currentFilter = filterConfig[filter]
  const clientsWithCoordinates = displayedClients.filter(hasCoordinates)
  const clientsWithoutCoordinates = displayedClients.filter(c => !hasCoordinates(c))

  return (
    <div className={`space-y-4 transition-all duration-300 ${panelOpen ? 'pr-[320px]' : ''}`}>
      {/* Banner: visita programada desde Agenda */}
      {visitClientIds && !visitBannerDismissed && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700">
          <CalendarDays className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Visita programada desde Agenda</span>
            <span className="ml-2 text-indigo-500">— {clients.length} cliente{clients.length !== 1 ? 's' : ''} seleccionado{clients.length !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={() => setVisitBannerDismissed(true)} className="text-indigo-400 hover:text-indigo-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: filterConfig[key].hex }}
              />
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
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-foreground/80 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {ROUTE_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>

            {/* Generate / clear route button */}
            {routeActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearRoute}
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5" /> Limpiar ruta
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateRoute(false)}
                disabled={generatingRoute || clientsWithCoordinates.length === 0 || loading}
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                title={`Generar ruta de ${routeType} (máx. ${MAX_ROUTE_STOPS} paradas — solo pendientes si hay lista activa)`}
              >
                {generatingRoute
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> GPS…</>
                  : <><Navigation className="h-3.5 w-3.5" /> Generar Ruta</>
                }
              </Button>
            )}
          </div>
        </div>

        {/* Sub-filtro atrasados: solo críticos ≥ 90 días */}
        {filter === 'overdue' && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Mostrar:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setMinDays(0)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  minDays === 0
                    ? 'text-white border-red-500'
                    : 'bg-white text-muted-foreground border-gray-300 hover:border-red-400'
                }`}
                style={minDays === 0 ? { backgroundColor: '#EF4444', borderColor: '#EF4444' } : {}}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 opacity-80" />
                Todos ({clients.length})
              </button>
              <button
                onClick={() => setMinDays(OVERDUE_90_THRESHOLD)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  minDays === OVERDUE_90_THRESHOLD
                    ? 'text-white border-red-900'
                    : 'bg-white text-muted-foreground border-gray-300 hover:border-red-700'
                }`}
                style={minDays === OVERDUE_90_THRESHOLD ? { backgroundColor: '#991B1B', borderColor: '#991B1B' } : {}}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#991B1B' }} />
                Críticos ≥ 90 días ({clients.filter(c => ((c as any).max_days_overdue ?? 0) >= OVERDUE_90_THRESHOLD).length})
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          {selectionMode
            ? '✅ Modo selección activo — haz clic en los marcadores del mapa para agregarlos a tu lista de visitas'
            : currentFilter.description
          }
          {!selectionMode && displayedClients.length > MAX_ROUTE_STOPS && visitEntries.length === 0 && (
            <span className="ml-1 text-amber-600">
              · La ruta incluirá las {MAX_ROUTE_STOPS} paradas más cercanas de {displayedClients.length} clientes
            </span>
          )}
          {visitEntries.length > 0 && pendingEntries.length < visitEntries.length && (
            <span className="ml-1 text-emerald-600 font-medium">
              · {visitEntries.length - pendingEntries.length} completadas · {pendingEntries.length} pendientes en ruta
            </span>
          )}
        </p>
      </Card>

      {/* Leyenda */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">{currentFilter.label}</h3>
        <div className="flex gap-4 text-sm flex-wrap">
          {filter === 'overdue' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }}></div>
                <span>Atrasado &lt; 90 días</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#991B1B' }}></div>
                <span>Atrasado ≥ 90 días (crítico)</span>
              </div>
            </>
          )}
          {filter === 'upcoming' && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#D97706' }}></div>
              <span>Próximo a vencer</span>
            </div>
          )}
          {filter === 'up-to-date' && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#16A34A' }}></div>
              <span>Al día — sin atrasos</span>
            </div>
          )}
          {filter === 'all' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }}></div>
                <span>Atrasado &lt; 90 días</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#991B1B' }}></div>
                <span>Atrasado ≥ 90 días (crítico)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#D97706' }}></div>
                <span>Próximo a vencer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2563EB' }}></div>
                <span>Con crédito activo</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Mapa */}
      <Card className="p-0 overflow-hidden relative">
        {/* "Limpiar ruta" overlay — only shown when a route is active */}
        {routeActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={handleClearRoute}
              className="flex items-center gap-1.5 bg-white shadow-md border border-gray-200 rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar ruta
            </button>
          </div>
        )}
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
          {/* Route polyline with stop markers */}
          {directionsResult && (
            <DirectionsRenderer
              directions={directionsResult}
              options={{
                suppressMarkers: false,
                polylineOptions: {
                  strokeColor: '#3B82F6',
                  strokeWeight: 5,
                  strokeOpacity: 0.85,
                },
              }}
            />
          )}

          {/* Hide individual markers when route is drawn — DirectionsRenderer shows its own */}
          {!routeActive && clientsWithCoordinates.map((client) => {
            const selected = isSelected(client.id)
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

          {selectedClient && hasCoordinates(selectedClient) && !selectionMode && (
            <InfoWindow
              position={{ lat: selectedClient.lat, lng: selectedClient.lng }}
              onCloseClick={() => setSelectedClient(null)}
            >
              <div className="p-2" style={{ minWidth: '220px' }}>
                {/* Client Photo */}
                <div className="flex justify-center mb-3">
                  <img
                    src={selectedClient.client_photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedClient.name) + '&size=64&background=random'}
                    alt={selectedClient.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      // Fallback to UI Avatars if image fails to load
                      e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedClient.name) + '&size=64&background=random';
                    }}
                  />
                </div>

                <h3 className="font-bold text-sm text-foreground mb-2">{selectedClient.name}</h3>

                <div className="space-y-1 text-xs text-muted-foreground mb-2">
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
                      <p className="text-muted-foreground text-xs">Monto Atrasado</p>
                      <p className="font-bold text-red-600">{formatCurrency(selectedClient.overdue_amount || 0)}</p>
                    </div>
                  )}
                  {filter === 'upcoming' && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Próximo Pago</p>
                      <p className="font-bold text-yellow-600">{formatCurrency(selectedClient.upcoming_amount || 0)}</p>
                      {selectedClient.next_due_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Vence: {formatDatePeru(selectedClient.next_due_date)}
                        </p>
                      )}
                    </div>
                  )}
                  {filter === 'up-to-date' && (
                    <div className="text-sm">
                      <p className="text-green-600 font-semibold">✓ Al día</p>
                    </div>
                  )}
                  {(filter === 'all' || filter === 'activation') && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Crédito usado</p>
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

      {clientsWithoutCoordinates.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {clientsWithoutCoordinates.length} deudor{clientsWithoutCoordinates.length !== 1 ? 'es' : ''} sin GPS
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/75">
                Tienen deuda activa, pero no se pueden fijar en el mapa hasta guardar coordenadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {clientsWithoutCoordinates.slice(0, 8).map(client => (
                <span key={client.id} className="rounded border border-amber-300 bg-background px-2 py-1 text-foreground dark:border-amber-800">
                  {client.name}
                </span>
              ))}
              {clientsWithoutCoordinates.length > 8 && (
                <span className="rounded border border-amber-300 bg-background px-2 py-1 text-muted-foreground dark:border-amber-800">
                  +{clientsWithoutCoordinates.length - 8}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {filter === 'overdue' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Clientes con Atraso</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Monto Atrasado</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(clients.reduce((sum, c) => sum + (c.overdue_amount || 0), 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Cuotas Vencidas</p>
              <p className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + (c.overdue_count || 0), 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
          </>
        )}
        {filter === 'upcoming' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Monto Próximo</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(clients.reduce((sum, c) => sum + (c.upcoming_amount || 0), 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Cuotas Próximas</p>
              <p className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + (c.upcoming_count || 0), 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
          </>
        )}
        {filter === 'up-to-date' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Clientes al Día</p>
              <p className="text-2xl font-bold text-green-600">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Pagos Realizados</p>
              <p className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + (c.payment_count || 0), 0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Límite Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_limit, 0))}
              </p>
            </Card>
          </>
        )}
        {filter === 'all' && (
          <>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Deuda Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_used, 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Límite Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(clients.reduce((sum, c) => sum + c.credit_limit, 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Uso Promedio</p>
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
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold text-violet-600">{clients.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Con Crédito Activo</p>
              <p className="text-2xl font-bold">
                {clients.filter(c => c.credit_limit > 0).length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Sin Crédito Asignado</p>
              <p className="text-2xl font-bold text-amber-600">
                {clients.filter(c => c.credit_limit === 0).length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Paradas en Ruta</p>
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
        onGenerateRoute={() => { handleClearRoute(); handleGenerateRoute(true) }}
        generatingRoute={generatingRoute}
        onVisitSaved={() => {
          // Reload map after a visit/payment is registered so counts and markers update
          if (visitClientIds) {
            loadClientsByIds(visitClientIds)
          } else {
            loadClients(filter)
          }
        }}
      />
    </div>
  )
}
