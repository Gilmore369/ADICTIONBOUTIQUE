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
import { ClientRating } from '@/lib/types/crm'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Phone, MapPin, Mail, Calendar, UserX } from 'lucide-react'
import { DeactivateClientDialog } from './deactivate-client-dialog'

interface ClientHeaderProps {
  client: any
  rating: ClientRating | null
  userRole?: string
}

export function ClientHeader({ client, rating, userRole }: ClientHeaderProps) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  
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
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {client.active ? 'Cliente Activo' : 'Cliente Inactivo'}
                  </p>
                </div>
                
                {/* Deactivation Button - Admin Only */}
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
                      Cumpleaños: {new Date(client.birthday).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rating Badge */}
            {rating && (
              <div className="flex flex-col items-center gap-2 p-4 border rounded-lg">
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
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
