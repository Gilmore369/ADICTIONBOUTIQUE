/**
 * Credit Plans List Page
 *
 * Server Component — displays all active credit plans grouped by client.
 * Uses Suspense for non-blocking rendering.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { CreditPlansView } from '@/components/debt/credit-plans-view'
import { Card } from '@/components/ui/card'
import { ChevronRight, DollarSign, ClipboardList } from 'lucide-react'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="p-0 overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreditPlansPage() {
  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        {/* Title + breadcrumb */}
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Inicio
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/debt" className="hover:text-foreground transition-colors">
              Cobranzas
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Planes de Crédito</span>
          </nav>

          <h1 className="text-xl font-semibold tracking-tight">Planes de Crédito</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clientes con crédito activo — expandí cada uno para ver sus cuotas
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/collections/payments"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Registrar pago
          </Link>
          <Link
            href="/collections/actions"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
            Nueva gestión
          </Link>
        </div>
      </div>

      {/* Content */}
      <Suspense fallback={<TableSkeleton />}>
        <CreditPlansView />
      </Suspense>
    </div>
  )
}
