'use client'

/**
 * Sale Receipt Component
 * 
 * Ticket de venta imprimible con logo, información de tienda y detalle de productos
 * Diseño basado en tickets térmicos de 80mm
 * 
 * Design tokens:
 * - Spacing: 8px, 16px
 * - Typography: Monospace para números
 * - Print-optimized: @media print styles
 */

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Printer, Mail, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import { sendReceiptEmail } from '@/actions/email'
import { toast } from 'sonner'

interface SaleReceiptProps {
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
  clientEmail?: string
  installments?: number
  installmentAmount?: number
  onClose: () => void
}

// Default store config
const DEFAULT_STORE_CONFIG = {
  name: 'ADICTION BOUTIQUE',
  address: 'Av. Principal 123, Trujillo',
  phone: '(044) 555-9999',
  ruc: '20123456789',
  logo: '/images/logo.png'
}

export function SaleReceipt({
  saleNumber,
  date,
  items,
  subtotal,
  discount,
  total,
  paymentType,
  clientName,
  clientEmail,
  installments,
  installmentAmount,
  onClose
}: SaleReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [storeConfig, setStoreConfig] = useState(DEFAULT_STORE_CONFIG)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState(clientEmail || '')
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    // Load store config from localStorage
    const savedConfig = localStorage.getItem('store_config')
    if (savedConfig) {
      try {
        setStoreConfig(JSON.parse(savedConfig))
      } catch (error) {
        console.error('Error loading store config:', error)
      }
    }

    // Load logo from localStorage
    const savedLogo = localStorage.getItem('store_logo')
    if (savedLogo) {
      setLogoUrl(savedLogo)
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch('/api/sales/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          saleNumber,
          date,
          items,
          subtotal,
          discount,
          total,
          paymentType,
          clientName,
          storeName: storeConfig.name,
          storeAddress: storeConfig.address,
          storePhone: storeConfig.phone,
          storeRuc: storeConfig.ruc,
          installments: paymentType === 'CREDITO' ? installments : undefined,
          installmentAmount: paymentType === 'CREDITO' ? installmentAmount : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Error generating PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Ticket_${saleNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF descargado exitosamente')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Error al descargar PDF')
    }
  }

  const handleSendEmail = async () => {
    if (!email) {
      toast.error('Ingresa un correo electrónico')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Formato de correo inválido')
      return
    }

    setSendingEmail(true)

    try {
      const result = await sendReceiptEmail({
        to: email,
        saleNumber,
        date,
        items,
        subtotal,
        discount,
        total,
        paymentType,
        clientName,
        installments,
        installmentAmount,
        storeName: storeConfig.name,
        storeAddress: storeConfig.address,
        storePhone: storeConfig.phone,
        storeRuc: storeConfig.ruc,
        logoUrl: logoUrl || undefined
      })

      if (result.success) {
        toast.success(`Ticket enviado a ${email}`)
        setShowEmailForm(false)
      } else {
        toast.error('Error al enviar email', result.error)
      }
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error('Error inesperado al enviar email')
    } finally {
      setSendingEmail(false)
    }
  }

  const displayLogo = logoUrl || storeConfig.logo

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header con botones - No se imprime */}
        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h2 className="text-lg font-semibold">Ticket de Venta</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Email input - No se imprime */}
        {showEmailForm && (
          <div className="p-4 border-b bg-gray-50 print:hidden">
            <Label className="text-sm mb-2 block">Enviar ticket por correo</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendEmail()
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                size="sm"
              >
                {sendingEmail ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        )}

        {/* Ticket content */}
        <div ref={receiptRef} className="p-6 receipt-content">
          {/* Logo y nombre de tienda */}
          <div className="text-center mb-4">
            <div className="flex justify-center mb-2">
              <img
                src={displayLogo}
                alt={storeConfig.name}
                className="h-16 w-auto"
                onError={(e) => {
                  // Si no hay logo, ocultar imagen
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <h1 className="text-xl font-bold">{storeConfig.name}</h1>
            <p className="text-sm text-gray-600">{storeConfig.address}</p>
            <p className="text-sm text-gray-600">Tel: {storeConfig.phone}</p>
            <p className="text-sm text-gray-600">RUC: {storeConfig.ruc}</p>
          </div>

          {/* Fecha y número de ticket */}
          <div className="text-center text-sm mb-4 pb-4 border-b border-dashed">
            <p>{formatSafeDate(date, 'dd/MM/yyyy HH:mm', 'Fecha no disponible')}</p>
            <p className="font-mono font-bold">TICKET: {saleNumber}</p>
            {clientName && (
              <p className="text-gray-600">Cliente: {clientName}</p>
            )}
          </div>

          {/* Items */}
          <div className="mb-4">
            <div className="flex justify-between text-sm font-semibold mb-2 pb-2 border-b">
              <span>C. DESCRIPCIÓN</span>
              <span>TOTAL</span>
            </div>
            {items.map((item, index) => (
              <div key={index} className="mb-3">
                <div className="flex justify-between text-sm">
                  <span>{item.quantity}</span>
                  <span className="flex-1 mx-2">{item.name}</span>
                  <span className="font-mono">{formatCurrency(item.subtotal, false)}</span>
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  @ {formatCurrency(item.unit_price)} c/u
                </div>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="border-t border-dashed pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Descuento:</span>
                <span className="font-mono">- {formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>TOTAL A PAGAR:</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Forma de pago */}
          <div className="mt-4 pt-4 border-t border-dashed text-center">
            <p className="text-sm font-semibold">
              F. PAGO: {paymentType === 'CONTADO' ? 'EFECTIVO' : 'CRÉDITO'}
            </p>
            {paymentType === 'CONTADO' && (
              <>
                <p className="text-sm">RECIBIDO: {formatCurrency(total, false)}</p>
                <p className="text-sm">VUELTO: 0.00</p>
              </>
            )}
          </div>

          {/* Cuotas - Solo para crédito */}
          {paymentType === 'CREDITO' && installments && installments > 1 && (
            <div className="mt-4 pt-4 border-t border-dashed">
              <p className="text-sm font-semibold text-center mb-3">
                PLAN DE CUOTAS ({installments} cuotas)
              </p>
              <div className="space-y-2">
                {Array.from({ length: installments }, (_, i) => {
                  const dueDate = new Date()
                  dueDate.setMonth(dueDate.getMonth() + i + 1)
                  const cuotaAmount = total / installments
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span>Cuota {i + 1}:</span>
                      <span className="font-mono">
                        {formatCurrency(cuotaAmount)} - Vence: {formatSafeDate(dueDate.toISOString(), 'dd/MM/yyyy', 'N/A')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mensaje de despedida */}
          <div className="mt-4 pt-4 border-t border-dashed text-center">
            <p className="text-sm text-gray-600">
              ¡Gracias por su preferencia! Vuelva pronto.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
