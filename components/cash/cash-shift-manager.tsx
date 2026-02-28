'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Calendar
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

interface CashShiftManagerProps {
  openShifts: CashShift[]
  recentShifts: CashShift[]
  userId: string
}

export function CashShiftManager({ openShifts, recentShifts, userId }: CashShiftManagerProps) {
  const [isOpening, setIsOpening] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [storeId, setStoreId] = useState('Tienda Hombres')
  const [closingAmount, setClosingAmount] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)

  // Get available stores (stores without open shifts)
  const openStoreIds = openShifts.map(shift => shift.store_id)
  const availableStores = [
    { id: 'Tienda Hombres', name: 'Tienda Hombres' },
    { id: 'Tienda Mujeres', name: 'Tienda Mujeres' }
  ].filter(store => !openStoreIds.includes(store.id))

  // Get current shift for selected store
  const currentShift = selectedShiftId 
    ? openShifts.find(s => s.id === selectedShiftId)
    : openShifts[0]

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
      window.location.reload()
    } else {
      toast.error(result.error || 'Error al abrir turno')
    }
    setIsOpening(false)
  }

  const handleCloseShift = async () => {
    if (!selectedShiftId) return
    
    if (!closingAmount || parseFloat(closingAmount) < 0) {
      toast.error('Ingrese un monto de cierre válido')
      return
    }

    setIsClosing(true)
    const result = await closeCashShift(selectedShiftId, parseFloat(closingAmount))
    
    if (result.success) {
      toast.success('Turno de caja cerrado exitosamente')
      setClosingAmount('')
      setSelectedShiftId(null)
      window.location.reload()
    } else {
      toast.error(result.error || 'Error al cerrar turno')
    }
    setIsClosing(false)
  }

  const handleAddExpense = async () => {
    if (!selectedShiftId) {
      toast.error('Seleccione un turno')
      return
    }

    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      toast.error('Ingrese un monto válido')
      return
    }

    if (!expenseCategory) {
      toast.error('Seleccione una categoría')
      return
    }

    const result = await addCashExpense(
      selectedShiftId,
      parseFloat(expenseAmount),
      expenseCategory,
      expenseDescription
    )

    if (result.success) {
      toast.success('Gasto registrado exitosamente')
      setExpenseAmount('')
      setExpenseCategory('')
      setExpenseDescription('')
      setSelectedShiftId(null)
    } else {
      toast.error(result.error || 'Error al registrar gasto')
    }
  }

  return (
    <div className="space-y-6">
      {/* Open Shifts */}
      {openShifts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {openShifts.map((shift) => (
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
                  <Badge variant="default" className="bg-green-500">
                    ABIERTO
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Monto de Apertura</Label>
                  <div className="text-2xl font-bold">S/ {shift.opening_amount.toFixed(2)}</div>
                </div>

                {/* Close Shift Form */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Cerrar Turno</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`closingAmount-${shift.id}`}>Monto de Cierre</Label>
                      <Input
                        id={`closingAmount-${shift.id}`}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={selectedShiftId === shift.id ? closingAmount : ''}
                        onChange={(e) => {
                          setSelectedShiftId(shift.id)
                          setClosingAmount(e.target.value)
                        }}
                      />
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedShiftId(shift.id)
                        handleCloseShift()
                      }}
                      disabled={isClosing}
                      className="w-full"
                    >
                      {isClosing && selectedShiftId === shift.id ? 'Cerrando...' : 'Cerrar Turno'}
                    </Button>
                  </div>
                </div>

                {/* Add Expense Form */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Registrar Gasto</h3>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`expenseAmount-${shift.id}`}>Monto</Label>
                        <Input
                          id={`expenseAmount-${shift.id}`}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={selectedShiftId === shift.id ? expenseAmount : ''}
                          onChange={(e) => {
                            setSelectedShiftId(shift.id)
                            setExpenseAmount(e.target.value)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`expenseCategory-${shift.id}`}>Categoría</Label>
                        <select
                          id={`expenseCategory-${shift.id}`}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={selectedShiftId === shift.id ? expenseCategory : ''}
                          onChange={(e) => {
                            setSelectedShiftId(shift.id)
                            setExpenseCategory(e.target.value)
                          }}
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
                      <Label htmlFor={`expenseDescription-${shift.id}`}>Descripción</Label>
                      <Textarea
                        id={`expenseDescription-${shift.id}`}
                        placeholder="Descripción del gasto..."
                        value={selectedShiftId === shift.id ? expenseDescription : ''}
                        onChange={(e) => {
                          setSelectedShiftId(shift.id)
                          setExpenseDescription(e.target.value)
                        }}
                      />
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedShiftId(shift.id)
                        handleAddExpense()
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Registrar Gasto
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                : 'Inicie un nuevo turno de caja para comenzar a operar'
              }
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
              <Label htmlFor="openingAmount">Monto de Apertura</Label>
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
              <p className="text-muted-foreground text-center py-8">
                No hay turnos cerrados
              </p>
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
                    {shift.difference !== null && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${
                        shift.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {shift.difference >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        S/ {Math.abs(shift.difference).toFixed(2)}
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
