'use client'

/**
 * Client Profile Component
 * 
 * Displays client information including photo, contact details, and location
 */

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Phone, Mail, Calendar, CreditCard, Edit } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'
import Image from 'next/image'

interface Client {
  id: string
  dni: string
  name: string
  phone?: string
  email?: string
  address?: string
  lat?: number
  lng?: number
  credit_limit: number
  credit_used: number
  client_photo_url?: string
  dni_photo_url?: string
  birthday?: string
  active: boolean
  created_at: string
}

import { formatCurrency } from '@/lib/utils/currency'

interface ClientProfileProps {
  client: Client
}

export function ClientProfile({ client }: ClientProfileProps) {
  const availableCredit = client.credit_limit - client.credit_used
  const creditUsagePercent = (client.credit_used / client.credit_limit) * 100

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          {/* Client Photo */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
            {client.client_photo_url ? (
              <Image
                src={client.client_photo_url}
                alt={client.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Client Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <Badge variant={client.active ? 'default' : 'secondary'}>
                {client.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">DNI: {client.dni}</p>
            {client.birthday && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Cumpleaños: {formatSafeDate(client.birthday, 'dd/MM/yyyy')}
              </p>
            )}
          </div>
        </div>

        {/* Edit Button */}
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold mb-2">Contacto</h3>
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${client.phone}`} className="hover:underline">
                {client.phone}
              </a>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${client.email}`} className="hover:underline">
                {client.email}
              </a>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{client.address}</span>
            </div>
          )}
          {client.lat && client.lng && (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto"
              onClick={() => window.open(`https://www.google.com/maps?q=${client.lat},${client.lng}`, '_blank')}
            >
              <MapPin className="h-3 w-3 mr-1" />
              Ver en mapa
            </Button>
          )}
        </div>

        {/* Credit Information */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold mb-2">Información de Crédito</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Límite de crédito:</span>
              <span className="font-semibold">{formatCurrency(client.credit_limit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Crédito usado:</span>
              <span className="font-semibold text-orange-600">{formatCurrency(client.credit_used)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Crédito disponible:</span>
              <span className="font-semibold text-green-600">{formatCurrency(availableCredit)}</span>
            </div>
          </div>

          {/* Credit Usage Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Uso de crédito</span>
              <span>{creditUsagePercent.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  creditUsagePercent > 90
                    ? 'bg-red-500'
                    : creditUsagePercent > 70
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* DNI Photo */}
      {client.dni_photo_url && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-2">Foto de DNI</h3>
          <div className="relative w-full max-w-md h-48 rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={client.dni_photo_url}
              alt="DNI"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </Card>
  )
}
