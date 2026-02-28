"use client"

import { useEffect, useRef, useState } from "react"

interface Client {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  debtStatus: 'overdue' | 'upcoming' | 'none'
  phone: string | null
  credit_used: number
}

interface ClientMapProps {
  clients: Client[]
}

export function ClientMap({ clients }: ClientMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [markers, setMarkers] = useState<google.maps.Marker[]>([])
  const [error, setError] = useState<string | null>(null)

  // Initialize Google Maps
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      setError("Google Maps API key no configurada")
      return
    }

    // Use new functional API instead of Loader class
    const initMap = async () => {
      try {
        // Check if Google Maps is already loaded
        if (!window.google?.maps) {
          // Check if script is already being loaded
          const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
          
          if (!existingScript) {
            // Dynamically load Google Maps script
            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`
            script.async = true
            script.defer = true
            
            await new Promise((resolve, reject) => {
              script.onload = resolve
              script.onerror = reject
              document.head.appendChild(script)
            })
          } else {
            // Wait for existing script to load
            await new Promise((resolve) => {
              const checkLoaded = setInterval(() => {
                if (window.google?.maps) {
                  clearInterval(checkLoaded)
                  resolve(true)
                }
              }, 100)
            })
          }
        }

        if (mapRef.current && !map && window.google?.maps) {
          const newMap = new google.maps.Map(mapRef.current, {
            center: { lat: -12.0464, lng: -77.0428 }, // Lima, Peru default
            zoom: 12,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          })
          setMap(newMap)
        }
      } catch (err) {
        console.error("Error loading Google Maps:", err)
        setError("Error al cargar Google Maps")
      }
    }

    initMap()
  }, [map])

  // Update markers when clients change
  useEffect(() => {
    if (!map) return

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null))

    // Filter clients with valid coordinates
    const validClients = clients.filter(
      client => client.lat !== null && client.lng !== null
    )

    if (validClients.length === 0) {
      setMarkers([])
      return
    }

    // Create new markers
    const newMarkers = validClients.map(client => {
      const marker = new google.maps.Marker({
        position: { lat: client.lat!, lng: client.lng! },
        map,
        title: client.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: getMarkerColor(client.debtStatus),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="
            background: white !important;
            padding: 16px;
            min-width: 220px;
            border-radius: 8px;
            font-family: system-ui, -apple-system, sans-serif;
          ">
            <h3 style="
              margin: 0 0 12px 0;
              font-size: 18px;
              font-weight: 600;
              color: #111827;
            ">${client.name}</h3>
            ${client.address ? `
              <p style="
                margin: 0 0 8px 0;
                font-size: 14px;
                color: #6b7280;
                line-height: 1.4;
              ">${client.address}</p>
            ` : ''}
            ${client.phone ? `
              <p style="
                margin: 0 0 8px 0;
                font-size: 14px;
                color: #374151;
              ">
                <span style="color: #ef4444;">📞</span> ${client.phone}
              </p>
            ` : ''}
            <div style="
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
            ">
              <p style="
                margin: 0 0 4px 0;
                font-size: 13px;
                color: #6b7280;
              ">Deuda actual</p>
              <p style="
                margin: 0 0 8px 0;
                font-size: 24px;
                font-weight: 700;
                color: #111827;
              ">S/ ${client.credit_used.toFixed(2)}</p>
              <p style="
                margin: 0;
                font-size: 13px;
                color: #6b7280;
              ">
                Estado: 
                <span style="
                  color: ${getStatusColor(client.debtStatus)};
                  font-weight: 600;
                ">
                  ${getStatusLabel(client.debtStatus)}
                </span>
              </p>
            </div>
          </div>
        `,
      })

      marker.addListener('click', () => {
        infoWindow.open(map, marker)
      })

      return marker
    })

    setMarkers(newMarkers)

    // Fit map bounds to show all markers
    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      newMarkers.forEach(marker => {
        const position = marker.getPosition()
        if (position) bounds.extend(position)
      })
      map.fitBounds(bounds)
      
      // Adjust zoom if only one marker
      if (newMarkers.length === 1) {
        map.setZoom(15)
      }
    }
  }, [map, clients])

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-red-600">{error}</p>
        <p className="text-sm text-gray-500 mt-2">
          Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local
        </p>
      </div>
    )
  }

  return (
    <div 
      ref={mapRef} 
      className="w-full rounded-lg border border-gray-200 overflow-hidden"
      style={{ height: '600px' }}
    />
  )
}

function getMarkerColor(status: Client['debtStatus']): string {
  switch (status) {
    case 'overdue':
      return '#ef4444' // red-500
    case 'upcoming':
      return '#eab308' // yellow-500
    case 'none':
      return '#22c55e' // green-500
    default:
      return '#6b7280' // gray-500
  }
}

function getStatusColor(status: Client['debtStatus']): string {
  return getMarkerColor(status)
}

function getStatusLabel(status: Client['debtStatus']): string {
  switch (status) {
    case 'overdue':
      return 'Vencido'
    case 'upcoming':
      return 'Por vencer'
    case 'none':
      return 'Sin deuda'
    default:
      return 'Desconocido'
  }
}
