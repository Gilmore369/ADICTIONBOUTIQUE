/**
 * Public Ticket Page
 * 
 * Página pública para visualizar y descargar tickets de venta
 * Accesible mediante código QR
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'

interface TicketData {
  saleNumber: string
  date: string
  items: Array<{
    quantity: number
    name: string
    unit_price: number
    subtotal: number
  }>
  subtotal: number
  discount: number
  total: number
  paymentType: 'CONTADO' | 'CREDITO'
  clientName?: string
  installments?: number
  storeName: string
}

export default function TicketPage() {
  const params = useParams()
  const saleNumber = params.saleNumber as string
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function fetchTicket() {
      try {
        const response = await fetch(`/api/tickets/${saleNumber}`)
        
        if (!response.ok) {
          throw new Error('Ticket no encontrado')
        }

        const { data } = await response.json()
        setTicket(data)
      } catch (err) {
        console.error('Error fetching ticket:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar ticket')
      } finally {
        setLoading(false)
      }
    }

    if (saleNumber) {
      fetchTicket()
    }
  }, [saleNumber])

  const handleDownloadPDF = async () => {
    if (!ticket) return

    setDownloading(true)
    try {
      const response = await fetch('/api/sales/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ticket)
      })

      if (!response.ok) {
        throw new Error('Error generating PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Ticket_${ticket.saleNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Error al descargar PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-600" />
          <p className="text-gray-600">Cargando ticket...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ticket no encontrado
          </h1>
          <p className="text-gray-600">
            {error || 'El ticket solicitado no existe o ha sido eliminado'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              ADICTION BOUTIQUE
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Ticket de Venta
            </p>
          </div>

          <div className="flex justify-between items-center py-4 border-t border-b">
            <div>
              <p className="text-sm text-gray-600">Ticket</p>
              <p className="font-mono font-bold">{ticket.saleNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Fecha</p>
              <p className="font-medium">
                {new Date(ticket.date).toLocaleDateString('es-PE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Lima',
                })}
              </p>
            </div>
          </div>

          {ticket.clientName && (
            <div className="mt-4 p-3 bg-yellow-50 rounded">
              <p className="text-sm font-medium">Cliente: {ticket.clientName}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4">Productos</h2>
          <div className="space-y-3">
            {ticket.items.map((item, index) => (
              <div key={index} className="flex justify-between items-start pb-3 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-600">
                    {item.quantity} x {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <p className="font-mono font-semibold">
                  {formatCurrency(item.subtotal)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono">{formatCurrency(ticket.subtotal)}</span>
            </div>
            {ticket.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento</span>
                <span className="font-mono text-red-600">
                  - {formatCurrency(ticket.discount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(ticket.total)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-center">
              <span className="font-semibold">Forma de pago:</span>{' '}
              {ticket.paymentType === 'CONTADO' ? 'Efectivo' : 'Crédito'}
            </p>
            {ticket.paymentType === 'CREDITO' && ticket.installments && (
              <p className="text-sm text-center text-gray-600 mt-1">
                {ticket.installments} cuotas de {formatCurrency(ticket.total / ticket.installments)}
              </p>
            )}
          </div>
        </div>

        {/* Download Button */}
        <Button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="w-full h-12 text-base font-semibold"
        >
          {downloading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generando PDF...
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              Descargar PDF
            </>
          )}
        </Button>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>¡Gracias por su preferencia!</p>
          <p className="mt-1">ADICTION BOUTIQUE</p>
        </div>
      </div>
    </div>
  )
}
