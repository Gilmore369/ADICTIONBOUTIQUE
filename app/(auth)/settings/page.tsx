import { Suspense } from 'react'
import { SettingsForm } from '@/components/settings/settings-form'
import { Card } from '@/components/ui/card'

export const metadata = {
  title: 'Configuración | Adiction Boutique',
  description: 'Configuración de la tienda',
}

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Configuración</h1>
        <p className="text-muted-foreground">
          Configura los datos de tu tienda y personaliza el ticket de venta
        </p>
      </div>

      <Suspense fallback={<Card className="p-4">Cargando...</Card>}>
        <SettingsForm />
      </Suspense>
    </div>
  )
}
