'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/contexts/store-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  ShoppingCart,
  CreditCard,
  Receipt,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { openCashShift, closeCashShift, addCashExpense } from '@/actions/cash'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CashShift {
  id: string
  store_id: string
  user_id: string
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  opened_at: string
  closed_at: string | null
  status: 'OPEN' | 'CLOSED'
}

interface ShiftBreakdown {
  cashSales: number
  creditSales: number
  collections: number
  expenses: number
  expensesList: { id: string; amount: number; category: string; description?: string; created_at: string }[]
}

interface CuadreResult {
  opening: number
  cashSales: number
  collections: number
  expenses: number
  expected: number
  closing: number
  difference: number
}

interface CashShiftManagerProps {
  openShifts: CashShift[]
  recentShifts: CashShift[]
  breakdowns: Record<string, ShiftBreakdown>
  userId: string
  allowedStoreIds?: string[]
}

function fmt(n: number) {
  return `S/ ${Math.abs(n).toFixed(2)}`
}

function CuadreRow({ label, value, icon, highlight }: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: 'positive' | 'negative' | 'neutral' | 'total'
}) {
  const colorMap = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-muted-foreground',
    total: 'text-foreground font-bold',
  }
  const color = colorMap[highlight || 'neutral']

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className={`text-sm ${color}`}>{fmt(value)}</span>
    </div>
  )
}

function CuadreModal({ result, storeName, onClose }: {
  result: CuadreResult
  storeName: string
  onClose: () => void
}) {
  const isOk = Math.abs(result.difference) < 0.01
  const isSobrante = result.difference > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Cuadre de Caja — {storeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Breakdown */}
          <div className="border rounded-lg p-4 space-y-1 bg-muted/30">
            <CuadreRow
              label="Apertura"
              value={result.opening}
              icon={<Wallet className="h-4 w-4" />}
            />
            <CuadreRow
              label="+ Ventas Contado"
              value={result.cashSales}
              icon={<ShoppingCart className="h-4 w-4" />}
              highlight="positive"
            />
            <CuadreRow
              label="+ Cobros Recibidos"
              value={result.collections}
              icon={<CreditCard className="h-4 w-4" />}
              highlight="positive"
            />
            <CuadreRow
              label="− Gastos"
              value={result.expenses}
              icon={<Minus className="h-4 w-4" />}
              highlight="negative"
            />
            <div className="border-t pt-2 mt-2">
              <CuadreRow
                label="= Efectivo Esperado"
                value={result.expected}
                icon={<DollarSign className="h-4 w-4" />}
                highlight="total"
              />
            </div>
          </div>

          {/* Real vs Expected */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Esperado en caja</span>
              <span className="font-semibold">{fmt(result.expected)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Contado real</span>
              <span className="font-semibold">{fmt(result.closing)}</span>
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-medium">Diferencia</span>
              <div className={`flex items-center gap-1 font-bold text-lg ${
                isOk ? 'text-green-600' : isSobrante ? 'text-blue-600' : 'text-red-600'
              }`}>
                {isOk ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isSobrante ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                {isOk ? 'Cuadrado' : `${isSobrante ? '+' : '-'}${fmt(result.difference)}`}
              </div>
            </div>
          </div>

          {/* Status message */}
          <div className={`rounded-lg p-3 text-sm text-center ${
            isOk
              ? 'bg-green-50 text-green-700 border border-green-200'
              : isSobrante
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {isOk
              ? '✅ Turno cuadrado perfectamente'
              : isSobrante
              ? `📈 Sobrante de ${fmt(result.difference)} — verificar cobros no registrados`
              : `⚠️ Faltante de ${fmt(result.difference)} — revisar ventas y gastos`}
          </div>

          <Button onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CashShiftManager({ openShifts, recentShifts, breakdowns, userId, allowedStoreIds }: CashShiftManagerProps) {
  const router = useRouter()
  const { selectedStore } = useStore()
  const [isOpening, setIsOpening] = useState(false)

  // Re-fetch server data when store filter changes
  useEffect(() => {
    router.refresh()
  }, [selectedStore]) // eslint-disable-line react-hooks/exhaustive-deps
  const [isClosing, setIsClosing] = useState<string | null>(null)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmounts, setClosingAmounts] = useState<Record<string, string>>({})
  const [expenseAmounts, setExpenseAmounts] = useState<Record<string, string>>({})
  const [expenseCategories, setExpenseCategories] = useState<Record<string, string>>({})
  const [expenseDescriptions, setExpenseDescriptions] = useState<Record<string, string>>({})
  const [addingExpense, setAddingExpense] = useState<string | null>(null)
  const [cuadreResult, setCuadreResult] = useState<(CuadreResult & { storeName: string }) | null>(null)
  const [showExpenses, setShowExpenses] = useState<Record<string, boolean>>({})

  const ALL_STORES = [
    { id: 'Tienda Mujeres', name: 'Tienda Mujeres' },
    { id: 'Tienda Hombres', name: 'Tienda Hombres' },
  ]
  const openStoreIds = openShifts.map(shift => shift.store_id)
  // Filter by user's allowed stores, then exclude already-open ones
  const availableStores = ALL_STORES
    .filter(s => !allowedStoreIds || allowedStoreIds.includes(s.id))
    .filter(s => !openStoreIds.includes(s.id))

  const [storeId, setStoreId] = useState(() => availableStores[0]?.id || 'Tienda Mujeres')

  const handleOpenShift = async () => {
    if (!openingAmount || parseFloat(openingAmount) < 0) {
      toast.error('Ingrese un monto de apertura válido')
      return
    }
    setIsOpening(true)
    const result = await openCashShift(storeId, parseFloat(openingAmount))
    if (result.success) {
      toast.success('Turno de caja abierto exitosamente')
      setOpeningAmount('')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al abrir turno')
    }
    setIsOpening(false)
  }

  const handleCloseShift = async (shiftId: string, storeName: string) => {
    const closing = closingAmounts[shiftId]
    if (!closing || parseFloat(closing) < 0) {
      toast.error('Ingrese el monto de cierre')
      return
    }
    setIsClosing(shiftId)
    const result = await closeCashShift(shiftId, parseFloat(closing))
    if (result.success && result.breakdown) {
      toast.success('Turno cerrado exitosamente')
      setClosingAmounts(prev => { const c = { ...prev }; delete c[shiftId]; return c })
      setCuadreResult({ ...result.breakdown, storeName })
      router.refresh()
    } else {
      toast.error(result.error || 'Error al cerrar turno')
    }
    setIsClosing(null)
  }

  const handleAddExpense = async (shiftId: string) => {
    const amount = expenseAmounts[shiftId]
    const category = expenseCategories[shiftId]
    const description = expenseDescriptions[shiftId]

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Ingrese un monto válido')
      return
    }
    if (!category) {
      toast.error('Seleccione una categoría')
      return
    }

    setAddingExpense(shiftId)
    const result = await addCashExpense(shiftId, parseFloat(amount), category, description)

    if (result.success) {
      toast.success('Gasto registrado exitosamente')
      setExpenseAmounts(prev => { const c = { ...prev }; delete c[shiftId]; return c })
      setExpenseCategories(prev => { const c = { ...prev }; delete c[shiftId]; return c })
      setExpenseDescriptions(prev => { const c = { ...prev }; delete c[shiftId]; return c })
      router.refresh()
    } else {
      toast.error(result.error || 'Error al registrar gasto')
    }
    setAddingExpense(null)
  }

  return (
    <div className="space-y-6">
      {/* Cuadre modal after close */}
      {cuadreResult && (
        <CuadreModal
          result={cuadreResult}
          storeName={cuadreResult.storeName}
          onClose={() => setCuadreResult(null)}
        />
      )}

      {/* Open Shifts */}
      {openShifts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {openShifts.map((shift) => {
            const bd = breakdowns[shift.id]
            const expectedLive = bd
              ? shift.opening_amount + bd.cashSales + bd.collections - bd.expenses
              : null
            const expensesList = bd?.expensesList || []
            const showExpList = showExpenses[shift.id]

            return (
              <Card key={shift.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {shift.store_id}
                      </CardTitle>
                      <CardDescription>
                        Abierto el {format(new Date(shift.opened_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                      </CardDescription>
                    </div>
                    <Badge variant="default" className="bg-green-500">ABIERTO</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Cuadre en vivo */}
                  {bd && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Cuadre en vivo
                      </p>
                      <CuadreRow
                        label="Apertura"
                        value={shift.opening_amount}
                        icon={<Wallet className="h-4 w-4" />}
                      />
                      <CuadreRow
                        label="+ Ventas Contado"
                        value={bd.cashSales}
                        icon={<ShoppingCart className="h-4 w-4" />}
                        highlight="positive"
                      />
                      {bd.creditSales > 0 && (
                        <CuadreRow
                          label="Ventas Crédito (no entra)"
                          value={bd.creditSales}
                          icon={<CreditCard className="h-4 w-4" />}
                          highlight="neutral"
                        />
                      )}
                      <CuadreRow
                        label="+ Cobros Recibidos"
                        value={bd.collections}
                        icon={<Plus className="h-4 w-4" />}
                        highlight="positive"
                      />
                      <CuadreRow
                        label="− Gastos"
                        value={bd.expenses}
                        icon={<Minus className="h-4 w-4" />}
                        highlight="negative"
                      />
                      <div className="border-t pt-2 mt-1">
                        <CuadreRow
                          label="= Efectivo Esperado"
                          value={expectedLive!}
                          icon={<DollarSign className="h-4 w-4" />}
                          highlight="total"
                        />
                      </div>

                      {/* Toggle gastos del turno */}
                      {expensesList.length > 0 && (
                        <button
                          onClick={() => setShowExpenses(prev => ({ ...prev, [shift.id]: !prev[shift.id] }))}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                        >
                          {showExpList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expensesList.length} gasto{expensesList.length !== 1 ? 's' : ''} registrado{expensesList.length !== 1 ? 's' : ''}
                        </button>
                      )}
                      {showExpList && (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          {expensesList.map(exp => (
                            <div key={exp.id} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {exp.category} {exp.description ? `— ${exp.description}` : ''}
                              </span>
                              <span className="text-red-500">−S/ {parseFloat(exp.amount.toString()).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Close Shift */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Cerrar Turno</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`closingAmount-${shift.id}`}>Monto Contado en Caja</Label>
                        <Input
                          id={`closingAmount-${shift.id}`}
                          type="number"
                          step="0.01"
                          placeholder={expectedLive != null ? `Esperado: ${expectedLive.toFixed(2)}` : '0.00'}
                          value={closingAmounts[shift.id] || ''}
                          onChange={(e) => setClosingAmounts(prev => ({ ...prev, [shift.id]: e.target.value }))}
                        />
                        {expectedLive != null && (
                          <p className="text-xs text-muted-foreground">
                            Efectivo esperado: <span className="font-medium">S/ {expectedLive.toFixed(2)}</span>
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleCloseShift(shift.id, shift.store_id)}
                        disabled={isClosing === shift.id}
                        className="w-full"
                      >
                        {isClosing === shift.id ? 'Cerrando...' : 'Cerrar Turno y Ver Cuadre'}
                      </Button>
                    </div>
                  </div>

                  {/* Add Expense */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Registrar Gasto</h3>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Monto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={expenseAmounts[shift.id] || ''}
                            onChange={(e) => setExpenseAmounts(prev => ({ ...prev, [shift.id]: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Categoría</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={expenseCategories[shift.id] || ''}
                            onChange={(e) => setExpenseCategories(prev => ({ ...prev, [shift.id]: e.target.value }))}
                          >
                            <option value="">Seleccionar...</option>
                            <option value="SERVICIOS">Servicios</option>
                            <option value="COMPRAS">Compras</option>
                            <option value="MANTENIMIENTO">Mantenimiento</option>
                            <option value="TRANSPORTE">Transporte</option>
                            <option value="OTROS">Otros</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea
                          placeholder="Descripción del gasto..."
                          value={expenseDescriptions[shift.id] || ''}
                          onChange={(e) => setExpenseDescriptions(prev => ({ ...prev, [shift.id]: e.target.value }))}
                        />
                      </div>
                      <Button
                        onClick={() => handleAddExpense(shift.id)}
                        disabled={addingExpense === shift.id}
                        variant="outline"
                        className="w-full"
                      >
                        {addingExpense === shift.id ? 'Registrando...' : 'Registrar Gasto'}
                      </Button>
                    </div>
                  </div>

                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Open New Shift */}
      {availableStores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Abrir Turno de Caja
            </CardTitle>
            <CardDescription>
              {openShifts.length > 0
                ? 'Abrir turno para la otra tienda'
                : 'Inicie un nuevo turno de caja para comenzar a operar'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeId">Tienda</Label>
              <select
                id="storeId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                {availableStores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingAmount">Monto de Apertura (efectivo inicial en caja)</Label>
              <Input
                id="openingAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <Button
              onClick={handleOpenShift}
              disabled={isOpening}
              className="w-full"
            >
              {isOpening ? 'Abriendo...' : 'Abrir Turno'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Turnos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentShifts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hay turnos cerrados</p>
            ) : (
              recentShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{shift.store_id}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(shift.closed_at!), "d 'de' MMMM, HH:mm", { locale: es })}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm text-muted-foreground">
                      Apertura: S/ {shift.opening_amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Cierre: S/ {shift.closing_amount?.toFixed(2)}
                    </div>
                    {shift.expected_amount != null && (
                      <div className="text-xs text-muted-foreground">
                        Esperado: S/ {shift.expected_amount.toFixed(2)}
                      </div>
                    )}
                    {shift.difference !== null && (
                      <div className={`flex items-center gap-1 justify-end text-sm font-medium ${
                        Math.abs(shift.difference) < 0.01
                          ? 'text-green-600'
                          : shift.difference > 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                      }`}>
                        {Math.abs(shift.difference) < 0.01 ? (
                          <><CheckCircle2 className="h-4 w-4" /> Cuadrado</>
                        ) : shift.difference > 0 ? (
                          <><TrendingUp className="h-4 w-4" /> +S/ {shift.difference.toFixed(2)}</>
                        ) : (
                          <><TrendingDown className="h-4 w-4" /> -S/ {Math.abs(shift.difference).toFixed(2)}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
