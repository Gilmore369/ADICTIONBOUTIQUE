import { AgendaCalendar } from '@/components/agenda/agenda-calendar'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AgendaPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="container mx-auto py-4 max-w-5xl">
      <AgendaCalendar />
    </div>
  )
}
