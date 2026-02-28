/**
 * POS Page
 * 
 * Point of Sale system for processing sales
 * Integrates ProductSearch, Cart, and sale type selection
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.8
 * Task: 11.4 Create POS page
 * Task: 12.2 Integrate createSale into POS page
 * 
 * Features:
 * - Product search and barcode scanning
 * - Cart management with discount
 * - Sale type selection (CONTADO/CREDITO)
 * - Client selection for credit sales
 * - Installment configuration (1-6 months)
 * - Credit limit validation
 * - Sale completion with Server Action
 * - Success/error toast notifications
 * - Automatic cart clearing on success
 * 
 * Design tokens used:
 * - Spacing: 16px, 24px
 * - Card padding: 16px
 * - Button height: 36px
 */

'use client'

import { useState, useEffect } from 'react'
import { ProductSearch } from '@/components/products/product-search'
import { Cart } from '@/components/pos/cart'
import { ProductScanner } from '@/components/pos/product-scanner'
import { SaleTypeSelector } from '@/components/pos/sale-type-selector'
import { ClientSelector } from '@/components/pos/client-selector'
import { SaleReceipt } from '@/components/pos/sale-receipt'
import { CreateClientDialog } from '@/components/clients/create-client-dialog'
import { useCart } from '@/hooks/use-cart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { createSale } from '@/actions/sales'
import { toast } from '@/lib/toast'

type SaleType = 'CONTADO' | 'CREDITO'

interface Client {
  id: string
  name: string
  dni?: string
  credit_limit: number
  credit_used: number
}

interface Product {
  id: string
  barcode: string | null
  name: string
  price: number
}

const VISUAL_CART_KEY = 'boutique_visual_cart'

export default function POSPage() {
  const { cart, addItem, removeItem, updateQuantity, updateDiscount, clearCart } = useCart()
  const [saleType, setSaleType] = useState<SaleType>('CONTADO')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [installments, setInstallments] = useState<number>(1)
  const [warehouse, setWarehouse] = useState<string>('Tienda Mujeres')
  const [processing, setProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)

  // ── Pre-load items from Visual Catalog cart (localStorage bridge) ──────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VISUAL_CART_KEY)
      if (!saved) return
      const items: Array<{
        product_id: string
        product_name: string
        barcode: string
        quantity: number
        unit_price: number
      }> = JSON.parse(saved)
      if (Array.isArray(items) && items.length > 0) {
        items.forEach(item => {
          addItem(
            {
              id:      item.product_id,
              name:    item.product_name,
              barcode: item.barcode || '',
              price:   item.unit_price,
            },
            item.quantity
          )
        })
        localStorage.removeItem(VISUAL_CART_KEY)
        toast.success(`${items.length} producto${items.length !== 1 ? 's' : ''} cargado${items.length !== 1 ? 's' : ''} desde el Catálogo Visual`)
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Handle product selection from search
  const handleProductSelect = (product: Product) => {
    addItem(
      {
        id: product.id,
        name: product.name,
        barcode: product.barcode || '',
        price: product.price
      },
      1
    )
  }

  // Handle barcode scan — must filter by current warehouse
  const handleBarcodeScan = async (barcode: string) => {
    try {
      const response = await fetch(
        `/api/products/search?q=${encodeURIComponent(barcode)}&warehouse=${encodeURIComponent(warehouse)}&limit=1`
      )
      const { data } = await response.json()

      if (data && data.length > 0) {
        handleProductSelect(data[0])
      } else {
        toast.error('Producto no encontrado', `No se encontró stock en tienda ${warehouse}`)
      }
    } catch (error) {
      console.error('Error scanning barcode:', error)
      toast.error('Error', 'Error al buscar producto')
    }
  }

  // Handle sale type change
  const handleSaleTypeChange = (type: SaleType) => {
    setSaleType(type)
    if (type === 'CONTADO') {
      setSelectedClient(null)
      setInstallments(1)
    }
  }

  // Validate sale before processing
  const canCompleteSale = () => {
    if (cart.items.length === 0) return false
    if (saleType === 'CREDITO') {
      if (!selectedClient) return false
      if (installments < 1 || installments > 6) return false
      // Check credit limit
      if (selectedClient.credit_used + cart.total > selectedClient.credit_limit) {
        return false
      }
    }
    return true
  }

  // Handle complete sale
  const handleCompleteSale = async () => {
    if (!canCompleteSale()) return

    setProcessing(true)
    
    try {
      // Prepare form data for Server Action
      const formData = new FormData()
      formData.append('store_id', warehouse)
      formData.append('sale_type', saleType)
      formData.append('discount', cart.discount.toString())
      
      // Add client_id and installments for CREDITO sales
      if (saleType === 'CREDITO' && selectedClient) {
        formData.append('client_id', selectedClient.id)
        formData.append('installments', installments.toString())
      }
      
      // Convert cart items to sale items format
      const saleItems = cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }))
      formData.append('items', JSON.stringify(saleItems))
      
      // Call createSale Server Action
      const result = await createSale(formData)
      
      if (!result.success) {
        console.error('[POS] createSale error:', result.error)
      }

      if (result.success) {
        // Prepare receipt data
        const installmentAmount = saleType === 'CREDITO' ? cart.total / installments : undefined
        
        setReceiptData({
          saleNumber: result.data.sale_number,
          date: new Date().toISOString(),
          items: cart.items.map(item => ({
            quantity: item.quantity,
            name: item.product_name,
            unit_price: item.unit_price,
            subtotal: item.subtotal
          })),
          subtotal: cart.subtotal,
          discount: cart.discount,
          total: cart.total,
          paymentType: saleType,
          clientName: selectedClient?.name,
          installments: saleType === 'CREDITO' ? installments : undefined,
          installmentAmount: installmentAmount
        })
        
        // Show receipt modal
        setShowReceipt(true)
        
        // Display success toast
        toast.success(
          'Venta completada',
          `Venta ${result.data.sale_number} por S/ ${result.data.total.toFixed(2)} registrada exitosamente`
        )
        
        // Clear cart and reset state
        clearCart()
        setSelectedClient(null)
        setInstallments(1)
        setSaleType('CONTADO')
      } else {
        // Display error toast
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : typeof result.error === 'object' && result.error !== null
            ? Object.entries(result.error as Record<string, string[]>)
                .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
                .join(' | ')
            : 'Error al procesar la venta'
        toast.error('Error al completar venta', errorMessage)
      }
    } catch (error) {
      console.error('Error completing sale:', error)
      toast.error(
        'Error inesperado',
        error instanceof Error ? error.message : 'Error al procesar la venta'
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Punto de Venta</h1>
          <p className="text-sm text-gray-600 mt-1">
            Sistema de ventas y gestión de caja
          </p>
        </div>
        
        {/* Warehouse Selector */}
        <Card className="p-3">
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Tienda
          </label>
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            disabled={processing}
            className="text-sm border rounded px-2 py-1 w-full"
          >
            <option value="Tienda Mujeres">Tienda Mujeres</option>
            <option value="Tienda Hombres">Tienda Hombres</option>
          </select>
        </Card>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Product Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Barcode Scanner */}
          <ProductScanner onScan={handleBarcodeScan} disabled={processing} />

          {/* Product Search */}
          <Card className="p-4">
            <label className="text-sm font-medium mb-2 block">
              Buscar Producto
            </label>
            <ProductSearch
              onSelect={handleProductSelect}
              placeholder="Buscar por nombre o código de barras..."
              warehouse={warehouse}
            />
          </Card>

          {/* Sale Type Selector */}
          <SaleTypeSelector
            value={saleType}
            onChange={handleSaleTypeChange}
            disabled={processing}
          />

          {/* Client Selector (only for credit sales) */}
          {saleType === 'CREDITO' && (
            <>
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">Cliente *</label>
                  <CreateClientDialog
                    trigger={
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        title="Crear nuevo cliente"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/><path d="M19 8h6M22 5v6"/></svg>
                        Nuevo cliente
                      </button>
                    }
                    onSuccess={client => {
                      setSelectedClient({
                        id:           client.id,
                        name:         client.name,
                        dni:          client.dni ?? undefined,
                        credit_limit: client.credit_limit,
                        credit_used:  client.credit_used,
                      })
                    }}
                  />
                </div>
                <ClientSelector
                  value={selectedClient}
                  onChange={setSelectedClient}
                  disabled={processing}
                  required
                />
              </Card>

              {/* Installments Input */}
              {selectedClient && (
                <Card className="p-4">
                  <label htmlFor="installments" className="text-sm font-medium mb-2 block">
                    Número de Cuotas (1-6)
                  </label>
                  <Input
                    id="installments"
                    type="number"
                    min="1"
                    max="6"
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    disabled={processing}
                    className="w-full"
                  />
                  {installments > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Cuota mensual: S/ {(cart.total / installments).toFixed(2)}
                    </p>
                  )}
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right Column - Cart */}
        <div className="space-y-4">
          <Cart
            items={cart.items}
            subtotal={cart.subtotal}
            discount={cart.discount}
            total={cart.total}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onUpdateDiscount={updateDiscount}
          />

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleCompleteSale}
              disabled={!canCompleteSale() || processing}
              className="w-full h-12 text-base font-semibold"
            >
              {processing ? 'Procesando...' : 'Completar Venta'}
            </Button>

            <Button
              variant="outline"
              onClick={clearCart}
              disabled={cart.items.length === 0 || processing}
              className="w-full"
            >
              Limpiar Carrito
            </Button>
          </div>

          {/* Credit Limit Warning */}
          {saleType === 'CREDITO' && selectedClient && (
            <Card className="p-4">
              {selectedClient.credit_used + cart.total > selectedClient.credit_limit ? (
                <div className="text-sm text-red-600">
                  ⚠️ El cliente excedería su límite de crédito
                </div>
              ) : (
                <div className="text-sm text-green-600">
                  ✓ Crédito disponible suficiente
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>

      {/* Sale Receipt Modal */}
      {showReceipt && receiptData && (
        <SaleReceipt
          {...receiptData}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </>
  )
}
