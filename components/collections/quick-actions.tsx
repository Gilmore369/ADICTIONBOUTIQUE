'use client'

/**
 * Quick Actions Component
 * 
 * Provides quick access buttons for common collection actions
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Phone, MessageCircle, DollarSign, Map } from 'lucide-react'

export function QuickActions() {
  return (
    <Card className="p-4">
      <h3 className="text-base font-semibold mb-3">Acciones Rápidas</h3>
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={() => {
            const phone = prompt('Ingresa el número de teléfono (con código de país):')
            if (phone) {
              window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank')
            }
          }}
        >
          <MessageCircle className="h-4 w-4" />
          Enviar WhatsApp
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={() => {
            const phone = prompt('Ingresa el número de teléfono:')
            if (phone) {
              window.location.href = `tel:${phone}`
            }
          }}
        >
          <Phone className="h-4 w-4" />
          Realizar Llamada
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={() => window.location.href = '/collections/payments'}
        >
          <DollarSign className="h-4 w-4" />
          Registrar Pago
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={() => window.location.href = '/map'}
        >
          <Map className="h-4 w-4" />
          Ver en Mapa
        </Button>
      </div>
    </Card>
  )
}
