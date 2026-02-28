'use client'

/**
 * Client Collection Actions Component
 * 
 * Displays client's collection actions history
 */

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatSafeDate } from '@/lib/utils/date'
import { Phone, MapPin, MessageCircle, Mail, Truck, FileText } from 'lucide-react'

interface CollectionAction {
  id: string
  action_type: string
  result: string
  payment_promise_date?: string
  notes?: string
  created_at: string
  user?: {
    name: string
  }
}

interface ClientCollectionActionsProps {
  actions: CollectionAction[]
}

const actionIcons: Record<string, any> = {
  LLAMADA: Phone,
  VISITA: MapPin,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MOTORIZADO: Truck,
  OTRO: FileText
}

const actionLabels: Record<string, string> = {
  LLAMADA: 'Llamada',
  VISITA: 'Visita',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  MOTORIZADO: 'Motorizado',
  OTRO: 'Otro'
}

const resultLabels: Record<string, string> = {
  COMPROMISO_PAGO: 'Compromiso de Pago',
  PROMETE_PAGAR_FECHA: 'Promete Pagar en Fecha',
  PAGO_REALIZADO: 'Pago Realizado',
  PAGO_PARCIAL: 'Pago Parcial',
  CLIENTE_COLABORADOR: 'Cliente Colaborador',
  SOLICITA_REFINANCIAMIENTO: 'Solicita Refinanciamiento',
  SOLICITA_DESCUENTO: 'Solicita Descuento',
  SE_NIEGA_PAGAR: 'Se Niega a Pagar',
  NO_CONTESTA: 'No Contesta',
  TELEFONO_INVALIDO: 'Teléfono Inválido',
  CLIENTE_MOLESTO: 'Cliente Molesto',
  DOMICILIO_INCORRECTO: 'Domicilio Incorrecto',
  CLIENTE_NO_UBICADO: 'Cliente No Ubicado',
  OTRO: 'Otro'
}

const resultColors: Record<string, string> = {
  COMPROMISO_PAGO: 'bg-green-100 text-green-800',
  PROMETE_PAGAR_FECHA: 'bg-blue-100 text-blue-800',
  PAGO_REALIZADO: 'bg-emerald-100 text-emerald-800',
  PAGO_PARCIAL: 'bg-teal-100 text-teal-800',
  CLIENTE_COLABORADOR: 'bg-cyan-100 text-cyan-800',
  SOLICITA_REFINANCIAMIENTO: 'bg-yellow-100 text-yellow-800',
  SOLICITA_DESCUENTO: 'bg-amber-100 text-amber-800',
  SE_NIEGA_PAGAR: 'bg-red-100 text-red-800',
  NO_CONTESTA: 'bg-gray-100 text-gray-800',
  TELEFONO_INVALIDO: 'bg-slate-100 text-slate-800',
  CLIENTE_MOLESTO: 'bg-orange-100 text-orange-800',
  DOMICILIO_INCORRECTO: 'bg-purple-100 text-purple-800',
  CLIENTE_NO_UBICADO: 'bg-pink-100 text-pink-800',
  OTRO: 'bg-purple-100 text-purple-800'
}

export function ClientCollectionActions({ actions }: ClientCollectionActionsProps) {
  if (actions.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay acciones de cobranza registradas
      </Card>
    )
  }

  return (
    <Card className="divide-y">
      {actions.map((action) => {
        const Icon = actionIcons[action.action_type] || FileText

        return (
          <div key={action.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <Icon className="h-5 w-5 text-gray-600" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">
                    {actionLabels[action.action_type] || action.action_type}
                  </span>
                  <Badge className={resultColors[action.result] || 'bg-gray-100 text-gray-800'}>
                    {resultLabels[action.result] || action.result}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground mb-2">
                  {formatSafeDate(action.created_at, 'dd/MM/yyyy HH:mm')}
                  {action.user?.name && ` • ${action.user.name}`}
                </p>

                {action.payment_promise_date && (
                  <p className="text-sm mb-2">
                    <span className="font-medium">Promesa de pago:</span>{' '}
                    {formatSafeDate(action.payment_promise_date, 'dd/MM/yyyy')}
                  </p>
                )}

                {action.notes && (
                  <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                    {action.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}
