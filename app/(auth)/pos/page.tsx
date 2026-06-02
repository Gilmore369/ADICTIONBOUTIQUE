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

import { useState, useEffect, useMemo } from 'react'
import { ProductSearch } from '@/components/products/product-search'
import { Cart } from '@/components/pos/cart'
import { ProductScanner } from '@/components/pos/product-scanner'
import { SaleTypeSelector } from '@/components/pos/sale-type-selector'
import { ClientSelector } from '@/components/pos/client-selector'
import { SaleReceipt } from '@/components/pos/sale-receipt'
import { CreateClientDialog } from '@/components/clients/create-client-dialog'
import { useCart } from '@/hooks/use-cart'
import { useStore } from '@/contexts/store-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { createSale } from '@/actions/sales'
import { openCashShift } from '@/actions/cash'
import { toast } from '@/lib/toast'
import { createBrowserClient } from '@/lib/supabase/client'
import { Loader2, DollarSign, Smartphone, CreditCard, Landmark } from 'lucide-react'

type SaleType = 'CONTADO' | 'CREDITO'

const POS_PAYMENT_METHODS = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: DollarSign },
  { value: 'YAPE_PLIN', label: 'Yape - Plin', icon: Smartphone },
  { value: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: Landmark },
]

interface Client {
  id: string
  name: string
  dni?: string
  credit_limit: number
  credit_used: number
  blacklisted?: boolean
  rating?: string
}

interface Product {
  id: string
  barcode: string | null
  name: string
  price: number
}

const VISUAL_CART_KEY = 'boutique_visual_cart'
const POS_SESSION_KEY = 'boutique_pos_session'

export default function POSPage() {
  const { cart, addItem, removeItem, updateQuantity, updateDiscount, clearCart } = useCart()
  const { selectedStore, storeName, isStoreLocked } = useStore() // Get global store selection
  const [saleType, setSaleType] = useState<SaleType>('CONTADO')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [installments, setInstallments] = useState<number>(1)
  const [warehouse, setWarehouse] = useState<string>('Tienda Mujeres')
  const [processing, setProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)

  // Payment method (CONTADO)
  const [posPaymentMethod, setPosPaymentMethod] = useState<string>('EFECTIVO')

  // Cash payment calculator
  const [cashReceived, setCashReceived] = useState<string>('')
  const cashReceivedNum = parseFloat(cashReceived) || 0
  const changeAmount = useMemo(
    () => Math.max(0, cashReceivedNum - cart.total),
    [cashReceivedNum, cart.total]
  )
  const cashShortfall = cashReceivedNum > 0 && cashReceivedNum < cart.total
    ? cart.total - cashReceivedNum : 0

  // Cash shift validation
  const [shiftOpen, setShiftOpen] = useState<boolean | null>(null) // null = loading
  const [cajaModalOpen, setCajaModalOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingCaja, setOpeningCaja] = useState(false)
  const supabaseBrowser = createBrowserClient()

  // ── Load persisted session state on mount ────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(POS_SESSION_KEY)
      if (!saved) return
      const session = JSON.parse(saved)
      if (session.saleType) setSaleType(session.saleType)
      if (session.selectedClient) setSelectedClient(session.selectedClient)
      if (session.installments) setInstallments(session.installments)
      if (session.warehouse) setWarehouse(session.warehouse)
    } catch { /* ignore */ }
  }, [])

  // ── Persist session state whenever it changes ────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(POS_SESSION_KEY, JSON.stringify({
        saleType,
        selectedClient,
        installments,
        warehouse,
      }))
    } catch { /* ignore */ }
  }, [saleType, selectedClient, installments, warehouse])

  // Sync warehouse with global store selection
  useEffect(() => {
    if (selectedStore === 'MUJERES') {
      setWarehouse('Tienda Mujeres')
    } else if (selectedStore === 'HOMBRES') {
      setWarehouse('Tienda Hombres')
    }
    // If 'ALL', keep current warehouse selection
  }, [selectedStore])

  // ── Check if there is an open cash shift for the current warehouse ──────────
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      setShiftOpen(null)
      const { data } = await supabaseBrowser
        .from('cash_shifts')
        .select('id')
        .eq('store_id', warehouse)
        .eq('status', 'OPEN')
        .limit(1)
      if (!cancelled) setShiftOpen((data?.length ?? 0) > 0)
    }
    check()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouse])

  // ── Abrir caja inline desde el POS ────────────────────────────────────────
  const handleOpenCaja = async () => {
    const opening = parseFloat(openingAmount)
    if (isNaN(opening) || opening < 0) { toast.error('Monto inválido', 'Ingresa un monto de apertura válido'); return }
    setOpeningCaja(true)
    try {
      const res = await openCashShift(warehouse, opening)
      if (!res.success) {
        toast.error('No se pudo abrir la caja', res.error || '')
        return
      }
      setShiftOpen(true)
      setCajaModalOpen(false)
      setOpeningAmount('')
      toast.success('Caja abierta', `Turno iniciado en ${warehouse}`)
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo abrir la caja')
    } finally {
      setOpeningCaja(false)
    }
  }

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

  // Handle barcode scan — siempre filtrar por el warehouse seleccionado
  const handleBarcodeScan = async (barcode: string) => {
    try {
      const response = await fetch(
        `/api/products/search?q=${encodeURIComponent(barcode)}&warehouse=${encodeURIComponent(warehouse)}&limit=1&strict=true`
      )
      const { data } = await response.json()

      if (data && data.length > 0) {
        const prod = data[0]
        if ((prod.stock?.quantity ?? 0) <= 0) {
          toast.warning('Producto sin stock', `${prod.name} no tiene stock en ${warehouse} — verifica antes de vender`)
        }
        handleProductSelect(prod)
      } else {
        toast.error('Producto no encontrado', `No existe un producto con ese código`)
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
      // Keep selectedClient so it can be used optionally
      setInstallments(1)
    }
  }

  // Validate sale before processing
  const canCompleteSale = () => {
    if (cart.items.length === 0) return false
    if (shiftOpen === false) return false   // no open cash shift
    if (saleType === 'CONTADO' && posPaymentMethod === 'EFECTIVO' && cashReceived !== '' && cashReceivedNum < cart.total) return false
    if (saleType === 'CREDITO') {
      if (!selectedClient) return false
      if (installments < 1 || installments > 6) return false
      if (selectedClient.blacklisted) return false
      if (selectedClient.credit_used + cart.total > selectedClient.credit_limit) return false
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
      if (saleType === 'CONTADO') formData.append('payment_method', posPaymentMethod)
      
      // client_id: required for CREDITO, optional for CONTADO
      if (selectedClient) {
        formData.append('client_id', selectedClient.id)
      }
      if (saleType === 'CREDITO') {
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
          paymentMethod: saleType === 'CONTADO' ? posPaymentMethod : undefined,
          clientName: selectedClient?.name,
          installments: saleType === 'CREDITO' ? installments : undefined,
          installmentAmount: installmentAmount,
          cashReceived: saleType === 'CONTADO' && cashReceivedNum > 0 ? cashReceivedNum : undefined,
          changeAmount: saleType === 'CONTADO' && cashReceivedNum > 0 ? changeAmount : undefined,
        })
        
        // Show receipt modal
        setShowReceipt(true)
        
        // Display success toast
        toast.success(
          'Venta completada',
          `Venta ${result.data.sale_number} por S/ ${result.data.total.toFixed(2)} registrada exitosamente`
        )
        
        // Clear cart and reset state (also clears localStorage)
        clearCart()
        setSelectedClient(null)
        setInstallments(1)
        setSaleType('CONTADO')
        setCashReceived('')
        setPosPaymentMethod('EFECTIVO')
        try { localStorage.removeItem(POS_SESSION_KEY) } catch { /* ignore */ }
      } else {
        // Caja cerrada → abrir modal inline en vez de error plano
        if (typeof result.error === 'string' && result.error.startsWith('CAJA_CERRADA::')) {
          setShiftOpen(false)
          setCajaModalOpen(true)
          return
        }
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
          <h1 className="text-2xl font-semibold text-foreground">Punto de Venta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema de ventas y gestión de caja
          </p>
        </div>
        
        {/* Warehouse Selector */}
        <Card className="p-3">
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Tienda {(cart.items.length > 0 || selectedStore !== 'ALL') && '🔒'}
          </label>
          <select
            value={warehouse}
            onChange={(e) => {
              console.log('[POS] Intentando cambiar tienda. Items en carrito:', cart.items.length)
              if (cart.items.length > 0) {
                console.log('[POS] BLOQUEADO - No se puede cambiar con productos en carrito')
                return
              }
              if (selectedStore !== 'ALL') {
                console.log('[POS] BLOQUEADO - Tienda seleccionada globalmente:', selectedStore)
                return
              }
              setWarehouse(e.target.value)
            }}
            disabled={processing || cart.items.length > 0 || selectedStore !== 'ALL'}
            className="text-sm border rounded px-2 py-1 w-full disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              cart.items.length > 0 
                ? 'No puedes cambiar de tienda con productos en el carrito' 
                : selectedStore !== 'ALL'
                  ? `Tienda bloqueada por selección global: ${storeName}`
                  : ''
            }
          >
            <option value="Tienda Mujeres">Tienda Mujeres</option>
            <option value="Tienda Hombres">Tienda Hombres</option>
          </select>
          {cart.items.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              🔒 Tienda bloqueada con productos en carrito
            </p>
          )}
          {cart.items.length === 0 && selectedStore !== 'ALL' && (
            <p className="text-xs text-blue-600 mt-1">
              🔒 Sincronizado con selección global: {storeName}
            </p>
          )}
        </Card>
      </div>

      {/* Cash shift warning */}
      {shiftOpen === false && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="text-lg">🔴</span>
          <div className="flex-1">
            <span className="font-semibold">Caja cerrada — no se pueden procesar ventas en {warehouse}.</span>
            <span className="ml-2 text-red-500">Abre un turno para empezar a vender.</span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setCajaModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Abrir caja
          </Button>
        </div>
      )}

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
              strictWarehouse={true}
            />
          </Card>

          {/* Sale Type Selector */}
          <SaleTypeSelector
            value={saleType}
            onChange={handleSaleTypeChange}
            disabled={processing}
          />

          {/* Client Selector — required for CREDITO, optional for CONTADO */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">
                Cliente {saleType === 'CREDITO' ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(opcional)</span>}
              </label>
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
                    blacklisted:  (client as any).blacklisted ?? false,
                    rating:       (client as any).rating ?? undefined,
                  })
                }}
              />
            </div>
            <ClientSelector
              value={selectedClient}
              onChange={setSelectedClient}
              disabled={processing}
              required={saleType === 'CREDITO'}
            />
            {saleType === 'CONTADO' && !selectedClient && (
              <p className="text-xs text-gray-400">
                Si seleccionas un cliente, la compra quedará registrada en su historial.
              </p>
            )}
          </Card>

          {/* Installments Input — only for CREDITO */}
          {saleType === 'CREDITO' && selectedClient && (
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

          {/* Payment method selector — CONTADO con items */}
          {saleType === 'CONTADO' && cart.total > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Método de pago</h3>
              <div className="grid grid-cols-4 gap-2">
                {POS_PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPosPaymentMethod(value)}
                    className={[
                      'flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all text-center leading-tight',
                      posPaymentMethod === value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700'
                        : 'border-border text-muted-foreground hover:border-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Confirmación para métodos no-efectivo */}
          {saleType === 'CONTADO' && cart.total > 0 && posPaymentMethod !== 'EFECTIVO' && (
            <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-700 dark:text-blue-300">
                  Total a cobrar ({POS_PAYMENT_METHODS.find(m => m.value === posPaymentMethod)?.label}):
                </span>
                <span className="font-bold text-foreground text-base">
                  {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(cart.total)}
                </span>
              </div>
            </Card>
          )}

          {/* Cash calculator — solo CONTADO + Efectivo */}
          {saleType === 'CONTADO' && cart.total > 0 && posPaymentMethod === 'EFECTIVO' && (
            <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-1.5">
                💵 Efectivo
              </h3>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-700 dark:text-emerald-400">Total a cobrar:</span>
                  <span className="font-bold text-foreground text-base">{new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(cart.total)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap w-24 shrink-0">Recibido:</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    className="h-9 text-right font-semibold text-base bg-card border-emerald-300 dark:border-emerald-700 focus:border-emerald-500"
                    autoFocus={false}
                  />
                </div>
                {cashShortfall > 0 && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    ⚠️ Falta: {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(cashShortfall)}
                  </p>
                )}
                {cashReceivedNum >= cart.total && cashReceived !== '' && (
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                    <span className="text-sm font-semibold text-emerald-800">Vuelto:</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(changeAmount)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

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

          {/* Blacklist Warning */}
          {saleType === 'CREDITO' && selectedClient?.blacklisted && (
            <Card className="p-4 border-red-500 bg-red-50">
              <div className="text-sm font-semibold text-red-700 flex items-center gap-2">
                🚫 Cliente en lista negra
              </div>
              <div className="text-xs text-red-600 mt-1">
                Tiene deuda vencida mayor a 10 días. No se puede procesar venta a crédito.
                Puede vender al contado o registrar un pago primero.
              </div>
            </Card>
          )}

          {/* Credit Limit Warning */}
          {saleType === 'CREDITO' && selectedClient && !selectedClient.blacklisted && (
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

      {/* Modal: Abrir caja */}
      {cajaModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !openingCaja && setCajaModalOpen(false)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🟢</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Abrir caja</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  No hay turno abierto en <strong>{warehouse}</strong>. Abre la caja para
                  poder registrar ventas y mantener la trazabilidad del turno.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <label className="text-sm font-medium text-foreground/85">Monto de apertura (S/)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                disabled={openingCaja}
              />
              <p className="text-xs text-muted-foreground">
                Efectivo con el que inicia la caja. Si no hay efectivo inicial, ingresa 0.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setCajaModalOpen(false); setOpeningAmount('') }}
                disabled={openingCaja}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleOpenCaja} disabled={openingCaja || openingAmount === ''}>
                {openingCaja ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Abriendo...</>
                ) : (
                  <>Abrir caja</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
