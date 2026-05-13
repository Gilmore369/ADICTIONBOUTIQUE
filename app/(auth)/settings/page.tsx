import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/settings-form'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Configuración | Adiction Boutique',
  description: 'Configuración de la tienda y perfil de usuario',
}

export default async function SettingsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, profile_photo_url')
    .eq('id', user.id)
    .single()

  const userProfile = {
    id: user.id,
    email: profile?.email || user.email || '',
    name: profile?.name || null,
    profile_photo_url: profile?.profile_photo_url || null,
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Configuración</h1>
        <p className="text-muted-foreground">
          Configura tu perfil y los datos de la tienda
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Mi Perfil</TabsTrigger>
          <TabsTrigger value="store">Configuración de Tienda</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings user={userProfile} />
        </TabsContent>

        <TabsContent value="store">
          <Suspense fallback={<Card className="p-4">Cargando...</Card>}>
            <SettingsForm />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
