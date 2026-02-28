'use client'

/**
 * CollectionsNav
 * Tab-style navigation bar for the Cobranzas section.
 * Highlights the active tab based on the current pathname.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DollarSign, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  {
    href: '/collections/payments',
    label: 'Registrar Pago',
    icon: DollarSign,
    description: 'Aplica pagos a cuotas pendientes',
  },
  {
    href: '/collections/actions',
    label: 'Acciones de Cobranza',
    icon: ClipboardList,
    description: 'Registra llamadas, visitas y gestiones',
  },
] as const

export function CollectionsNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b">
      {TABS.map(tab => {
        const active = pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
