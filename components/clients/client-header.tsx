/**
 * Client Header Component
 * 
 * Displays client name, rating badge, and key information at the top
 * of the client profile page.
 * 
 * Requirements: 1.1, 2.1, 4.1, 13.3
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClientRating } from '@/lib/types/crm'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Phone, MapPin, Mail, Calendar, UserX, RefreshCw } from 'lucide-react'
import { DeactivateClientDialog } from './deactivate-client-dialog'
import { EditClientDialog } from './edit-client-dialog'
import { calculateAndUpdateRating } from '@/actions/ratings'

interface ClientHeaderProps {
  client: any
  rating: ClientRating | null
  userRole?: string
}

export function ClientHeader({ client, rating, userRole }: ClientHeaderProps) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const router = useRouter()

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await calculateAndUpdateRating(client.id)
      router.refresh()
    } finally {
      setRecalculating(false)
    }
  }
  
  // Get rating color based on category
  const getRatingColor = (category: string) => {
    switch (category) {
      case 'A':
        return 'bg-green-500 hover:bg-green-600'
      case 'B':
        return 'bg-blue-500 hover:bg-blue-600'
      case 'C':
        return 'bg-yellow-500 hover:bg-yellow-600'
      case 'D':
        return 'bg-red-500 hover:bg-red-600'
      default:
        return 'bg-gray-500 hover:bg-gray-600'
    }
  }

  const isAdmin = userRole === 'admin'
  const canDeactivate = isAdmin && client.active

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Client Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                {/* Client Photo */}
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20">
                  {client.client_photo_url ? (
                    <img 
                      src={client.client_photo_url} 
                      alt={client.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {client.active ? 'Cliente Activo' : 'Cliente Inactivo'}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditDialogOpen(true)}
                    className="gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar
                  </Button>
                  
                  {canDeactivate && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeactivateDialogOpen(true)}
                      className="gap-2"
                    >
                      <UserX className="h-4 w-4" />
                      Dar de Baja
                    </Button>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {client.dni && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>DNI: {client.dni}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{client.address}</span>
                  </div>
                )}
                {client.birthday && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Cumpleaños: {(() => {
                        // Parse as local date (YYYY-MM-DD) to avoid UTC timezone shift
                        const [y, m, d] = (client.birthday as string).split('-')
                        return d && m && y ? `${d}/${m}/${y}` : client.birthday
                      })()}
                    </span>
                  </div>
                )}
                {(client.lat && client.lng) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`https://www.google.com/maps?q=${client.lat},${client.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Ver en mapa
                    </a>
                  </div>
                )}
              </div>

              {/* Photos Section */}
              {(client.dni_photo_url || client.client_photo_url) && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Documentos</p>
                  <div className="flex gap-3">
                    {client.dni_photo_url && (
                      <a 
                        href={client.dni_photo_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className="relative w-24 h-16 rounded border overflow-hidden hover:opacity-80 transition-opacity">
                          <img 
                            src={client.dni_photo_url} 
                            alt="DNI"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                            DNI
                          </div>
                        </div>
                      </a>
                    )}
                    {client.client_photo_url && (
                      <a 
                        href={client.client_photo_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className="relative w-24 h-16 rounded border overflow-hidden hover:opacity-80 transition-opacity">
                          <img 
                            src={client.client_photo_url} 
                            alt="Foto del cliente"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                            Foto
                          </div>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rating Badge */}
            <div className="flex flex-col items-center gap-2 p-4 border rounded-lg min-w-[110px]">
              {rating ? (
                <>
                  <Badge className={`${getRatingColor(rating.rating)} text-white text-lg px-4 py-2`}>
                    {rating.rating}
                  </Badge>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{rating.score}</p>
                    <p className="text-xs text-muted-foreground">Puntuación</p>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    <p>Puntualidad: {rating.payment_punctuality}%</p>
                    <p>Frecuencia: {rating.purchase_frequency}</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center">Sin clasificación</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRecalculate}
                disabled={recalculating}
                className="w-full text-xs gap-1 mt-1"
                title="Recalcular clasificación"
              >
                <RefreshCw className={`h-3 w-3 ${recalculating ? 'animate-spin' : ''}`} />
                {recalculating ? 'Calculando...' : 'Recalcular'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editDialogOpen && (
        <EditClientDialog
          client={client}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      {/* Deactivation Dialog */}
      <DeactivateClientDialog
        clientId={client.id}
        clientName={client.name}
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
      />
    </>
  )
}
