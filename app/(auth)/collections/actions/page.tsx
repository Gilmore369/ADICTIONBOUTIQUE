/**
 * Collection Actions Page — /collections/actions
 *
 * Renders the action form + quick-links on the right, then the history table.
 * The section header and tab nav are provided by collections/layout.tsx.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { CollectionActionForm } from '@/components/collections/collection-action-form'
import { CollectionActionsTable } from '@/components/collections/collection-actions-table'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { Card } from '@/components/ui/card'
import {
  DollarSign, Map, CreditCard, ArrowRight,
  Phone, Handshake, FileText, Car,
} from 'lucide-react'

function ActionsTableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  )
}

async function CollectionActionsList() {
  const supabase = await createServerClient()

  const { data: actions, error } = await supabase
    .from('collection_actions')
    .select(`
      id,
      client_id,
      client_name,
      action_type,
      result,
      payment_promise_date,
      notes,
      user_id,
      created_at,
      user:users ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm">
        Error al cargar las acciones: {error.message}
      </div>
    )
  }

  const transformedActions = (actions || []).map((a: any) => ({
    id: a.id,
    client_id: a.client_id,
    client_name: a.client_name,
    action_type: a.action_type,
    result: a.result,
    payment_promise_date: a.payment_promise_date,
    notes: a.notes,
    user_id: a.user_id,
    user_name: a.user?.name,
    created_at: a.created_at,
  }))

  return <CollectionActionsTable actions={transformedActions} />
}

// Quick navigation links
const QUICK_LINKS = [
  { href: '/collections/payments', icon: DollarSign, label: 'Registrar Pago', desc: 'Aplica cobros a cuotas' },
  { href: '/map',                  icon: Map,         label: 'Ver Mapa',        desc: 'Rutas y ubicaciones' },
  { href: '/debt/plans',           icon: CreditCard,  label: 'Planes de Crédito', desc: 'Ver cuotas pendientes' },
] as const

// Collection tips
const TIPS = [
  { icon: Phone,     title: 'Llamadas',          body: 'Registra cada intento de contacto para tener un historial completo.' },
  { icon: Handshake, title: 'Promesas de Pago',  body: 'Ingresa siempre la fecha prometida para hacer seguimiento.' },
  { icon: FileText,  title: 'Notas Detalladas',  body: 'Documenta conversaciones y acuerdos importantes.' },
  { icon: Car,       title: 'Visitas',           body: 'Planifica rutas eficientes desde el módulo Mapa.' },
] as const

export default function CollectionActionsPage() {
  return (
    <div className="space-y-8">
      {/* Form + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Action Form */}
        <CollectionActionForm />

        {/* Right: Quick links + tips */}
        <div className="space-y-4">
          {/* Quick links */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Acciones Rápidas</h3>
            <div className="space-y-1.5">
              {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium leading-none">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </Card>

          {/* Tips */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Consejos de Cobranza</h3>
            <div className="space-y-3">
              {TIPS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium leading-none">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Actions history */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Historial de Acciones</h2>
        <Suspense fallback={<ActionsTableSkeleton />}>
          <CollectionActionsList />
        </Suspense>
      </section>
    </div>
  )
}
