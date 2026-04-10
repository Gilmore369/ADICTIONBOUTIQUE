import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { getReturnsAction } from '@/actions/returns'
import { ReturnsManagementView } from '@/components/returns/returns-management-view'

export const metadata = {
  title: 'Devoluciones | ADICTION BOUTIQUE',
  description: 'Gestión de devoluciones y cambios'
}

export default async function ReturnsPage() {
  // Read selected-store cookie and user stores for filtering
  const cookieStore = await cookies()
  const cookieSelected = cookieStore.get('selected-store')?.value

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('stores').eq('id', user.id).single()
    : { data: null }
  const userStores: string[] = (profile as any)?.stores || []

  const { data: returns } = await getReturnsAction(userStores, cookieSelected)

  return <ReturnsManagementView initialReturns={returns} />
}
