/**
 * Credit Plan Detail Page
 * 
 * Server Component that displays a single credit plan with its installments.
 * Uses Suspense for loading states.
 * 
 * Requirements: 9.1 - Load UI without waiting for data (lazy loading with Suspense)
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CreditPlanCard } from '@/components/debt/credit-plan-card'
import { InstallmentsTable } from '@/components/debt/installments-table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

// Loading skeleton for plan details
function PlanDetailSkeleton() {
  return (
    <div className="space-y-8">
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Card className="p-4">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    </div>
  )
}

// Server Component to fetch and display plan details
async function PlanDetails({ id }: { id: string }) {
  const supabase = await createServerClient()

  // Fetch credit plan with client and sale information
  const { data: plan, error: planError } = await supabase
    .from('credit_plans')
    .select(`
      id,
      total_amount,
      installments_count,
      installment_amount,
      status,
      created_at,
      client:clients (
        id,
        name,
        dni
      ),
      sale:sales (
        id,
        sale_number,
        created_at
      )
    `)
    .eq('id', id)
    .single()

  if (planError || !plan) {
    notFound()
  }

  // Fetch installments for this plan
  const { data: installments, error: installmentsError } = await supabase
    .from('installments')
    .select('*')
    .eq('plan_id', id)
    .order('due_date', { ascending: true })

  if (installmentsError) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error al cargar las cuotas</p>
        <p className="text-sm text-muted-foreground mt-2">{installmentsError.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Plan Details Card */}
      <CreditPlanCard plan={plan as any} />

      {/* Installments Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Cuotas</h2>
        <InstallmentsTable installments={installments || []} />
      </div>
    </div>
  )
}

export default async function CreditPlanDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back Button */}
      <div className="mb-8">
        <Link href="/debt/plans">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Planes
          </Button>
        </Link>
        
        <h1 className="text-2xl font-semibold mb-2">Detalle del Plan de Crédito</h1>
        <p className="text-muted-foreground">
          Información completa del plan y sus cuotas
        </p>
      </div>

      <Suspense fallback={<PlanDetailSkeleton />}>
        <PlanDetails id={id} />
      </Suspense>
    </div>
  )
}
