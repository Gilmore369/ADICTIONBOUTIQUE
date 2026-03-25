import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CrmDashboard } from '@/components/clients/crm-dashboard'

export default async function ClientDashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!userRoles.includes('admin') && !userRoles.includes('vendedor') && !userRoles.includes('cobrador')) {
    redirect('/')
  }

  return (
    <div className="space-y-1">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard CRM</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Métricas, cobranzas y análisis de clientes en tiempo real
        </p>
      </div>
      <CrmDashboard />
    </div>
  )
}
