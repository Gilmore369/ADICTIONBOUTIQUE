'use client'

/**
 * Client Detail View Component
 * 
 * Comprehensive view of client information including:
 * - Personal info with photos
 * - Location map
 * - Purchase history
 * - Credit plans
 * - Collection actions
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, MapPin, Phone, Mail, Calendar, CreditCard, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatSafeDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'
import Image from 'next/image'

interface Client {
  id: string
  dni: string
  name: string
  phone?: string
  email?: string
  address?: string
  lat?: number
  lng?: number
  credit_limit: number
  credit_used: number
  dni_photo_url?: string
  client_photo_url?: string
  birthday?: string
  created_at: string
}

interface Sale {
  id: string
  sale_number: string
  sale_type: string
  total: number
  created_at: string
}

interface CreditPlan {
  id: string
  total_amount: number
  installments_count: number
  created_at: string
  installments: Array<{
    id: string
    installment_number: number
    amount: number
    due_date: string
    paid_date?: string
    status: string
  }>
}

interface CollectionAction {
  id: string
  action_type: string
  result: string
  notes?: string
  created_at: string
}

interface ClientDetailViewProps {
  client: Client
  sales: Sale[]
  creditPlans: CreditPlan[]
  collectionActions: CollectionAction[]
}

export function ClientDetailView({ 
  client, 
  sales, 
  creditPlans, 
  collectionActions 
}: ClientDetailViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('info')

  const creditAvailable = client.credit_limit - client.credit_used
  const creditUsagePercent = (client.credit_used / client.credit_limit) * 100

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">DNI: {client.dni}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Client Info */}
        <div className="space-y-4">
          {/* Photos Card */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Fotos</h3>
            <div className="space-y-4">
              {client.client_photo_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Foto del Cliente</p>
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={client.client_photo_url}
                      alt="Foto del cliente"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              {client.dni_photo_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Foto del DNI</p>
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={client.dni_photo_url}
                      alt="Foto del DNI"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              {!client.client_photo_url && !client.dni_photo_url && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin fotos registradas
                </p>
              )}
            </div>
          </Card>

          {/* Contact Info Card */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Información de Contacto</h3>
            <div className="space-y-3 text-sm">
              {client.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="font-medium">{client.phone}</p>
                  </div>
                </div>
              )}
              {client.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="font-medium">{client.address}</p>
                  </div>
                </div>
              )}
              {client.birthday && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cumpleaños</p>
                    <p className="font-medium">{formatSafeDate(client.birthday, 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Credit Info Card */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Información de Crédito</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Crédito Usado</span>
                  <span className="font-semibold">{formatCurrency(client.credit_used)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Límite de Crédito</span>
                  <span className="font-semibold">{formatCurrency(client.credit_limit)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Crédito Disponible</span>
                  <span className="font-semibold text-green-600">{formatCurrency(Math.max(0, creditAvailable))}</span>
                </div>
              </div>
              
              {/* Credit Usage Bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Uso de Crédito</span>
                  <span>{creditUsagePercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      creditUsagePercent > 90
                        ? 'bg-red-500'
                        : creditUsagePercent > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Map Card */}
          {client.lat && client.lng && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Ubicación</h3>
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Mapa: {client.lat.toFixed(6)}, {client.lng.toFixed(6)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => window.open(`https://www.google.com/maps?q=${client.lat},${client.lng}`, '_blank')}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Ver en Google Maps
              </Button>
            </Card>
          )}
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Compras</TabsTrigger>
              <TabsTrigger value="credit">Créditos</TabsTrigger>
              <TabsTrigger value="actions">Acciones</TabsTrigger>
            </TabsList>

            {/* Purchase History Tab */}
            <TabsContent value="info" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Historial de Compras</h3>
                {sales.length > 0 ? (
                  <div className="space-y-3">
                    {sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{sale.sale_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatSafeDate(sale.created_at, 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(sale.total)}</p>
                          <Badge variant={sale.sale_type === 'CREDITO' ? 'secondary' : 'default'}>
                            {sale.sale_type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Sin compras registradas
                  </p>
                )}
              </Card>
            </TabsContent>

            {/* Credit Plans Tab */}
            <TabsContent value="credit" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Planes de Crédito</h3>
                {creditPlans.length > 0 ? (
                  <div className="space-y-4">
                    {creditPlans.map((plan) => {
                      const paidInstallments = plan.installments.filter(i => i.status === 'PAID').length
                      const totalInstallments = plan.installments.length
                      
                      return (
                        <div key={plan.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-medium">Plan de {formatCurrency(plan.total_amount)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatSafeDate(plan.created_at, 'dd/MM/yyyy')}
                              </p>
                            </div>
                            <Badge>
                              {paidInstallments}/{totalInstallments} cuotas
                            </Badge>
                          </div>
                          
                          {/* Installments */}
                          <div className="space-y-2">
                            {plan.installments.slice(0, 3).map((inst) => (
                              <div
                                key={inst.id}
                                className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded"
                              >
                                <span>Cuota {inst.installment_number}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{formatCurrency(inst.amount)}</span>
                                  <Badge
                                    variant={inst.status === 'PAID' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {inst.status === 'PAID' ? 'Pagada' : 'Pendiente'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {plan.installments.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{plan.installments.length - 3} cuotas más
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Sin planes de crédito
                  </p>
                )}
              </Card>
            </TabsContent>

            {/* Collection Actions Tab */}
            <TabsContent value="actions" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Acciones de Cobranza</h3>
                {collectionActions.length > 0 ? (
                  <div className="space-y-3">
                    {collectionActions.map((action) => (
                      <div
                        key={action.id}
                        className="border rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <Badge>{action.action_type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatSafeDate(action.created_at, 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-1">
                          Resultado: {action.result}
                        </p>
                        {action.notes && (
                          <p className="text-sm text-muted-foreground">
                            {action.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Sin acciones registradas
                  </p>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
