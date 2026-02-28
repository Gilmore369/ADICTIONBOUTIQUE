'use client'

/**
 * PaymentsPanel
 *
 * Client wrapper that manages clientId + amount state shared between
 * PaymentForm (left) and PaymentSummary (right).
 *
 * Also shows a quick-link card to the Acciones de Cobranza page.
 */

import { useState } from 'react'
import Link from 'next/link'
import { PaymentForm } from './payment-form'
import { PaymentSummary } from './payment-summary'
import { Card } from '@/components/ui/card'
import { ClipboardList, ArrowRight, Info, CheckCircle2 } from 'lucide-react'

export function PaymentsPanel() {
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState(0)

  const hasSummary = clientId && amount > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Payment Form */}
      <PaymentForm
        onClientChange={setClientId}
        onAmountChange={setAmount}
      />

      {/* Right: Summary or info card */}
      <div className="space-y-4">
        {hasSummary ? (
          <PaymentSummary clientId={clientId} paymentAmount={amount} />
        ) : (
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" />
                Cómo funciona el registro de pago
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  'Busca al cliente por nombre o DNI',
                  'Ingresa el monto recibido',
                  'El sistema aplica el pago a las cuotas más antiguas primero',
                  'Se actualiza automáticamente el saldo del cliente',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Selecciona un cliente e ingresa un monto para ver la simulación de cómo se aplicará el pago a las cuotas pendientes.
            </p>
          </Card>
        )}

        {/* Quick link to collection actions */}
        <Link
          href="/collections/actions"
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors px-4 py-3 text-sm"
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="font-medium text-foreground">Registrar acción de cobranza</p>
              <p className="text-xs text-muted-foreground">Llamadas, visitas y gestiones de cobro</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      </div>
    </div>
  )
}
