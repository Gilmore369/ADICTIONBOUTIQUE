'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect } from 'react'

export default function CleanupPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/catalogs/suppliers')
      const { data } = await response.json()
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
      toast.error('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!selectedSupplier) {
      toast.error('Selecciona un proveedor')
      return
    }

    setCleaning(true)
    try {
      const response = await fetch('/api/admin/cleanup-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: selectedSupplier })
      })

      const result = await response.json()

      if (response.ok) {
        setResults(result)
        toast.success(result.message)
      } else {
        toast.error(result.error || 'Error al limpiar duplicados')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error inesperado')
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Limpiar Productos Duplicados</h1>
        <p className="text-gray-600 mt-2">
          Consolida productos duplicados con el mismo nombre, talla y color
        </p>
      </div>

      <Card className="p-6 border-yellow-200 bg-yellow-50">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold">Advertencia</p>
            <p className="mt-1">
              Esta operación consolidará todos los productos duplicados en un solo registro y sumará el stock.
              Los códigos de barras duplicados se eliminarán, manteniendo solo el primero.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label>Seleccionar Proveedor *</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier} disabled={loading || cleaning}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar proveedor"} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCleanup}
            disabled={!selectedSupplier || cleaning}
            className="w-full"
            size="lg"
          >
            {cleaning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Limpiando...
              </>
            ) : (
              'Ejecutar Limpieza'
            )}
          </Button>
        </div>
      </Card>

      {results && (
        <Card className="p-6 bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-900 mb-4">Resultados</h3>
          <div className="space-y-3 text-sm">
            <p className="text-green-800">
              <span className="font-semibold">{results.results?.length || 0}</span> grupos de duplicados consolidados
            </p>
            {results.results?.map((result: any, idx: number) => (
              <div key={idx} className="bg-white p-3 rounded border border-green-200">
                <p className="font-mono text-xs">
                  <span className="font-semibold">Principal:</span> {result.primary}
                </p>
                <p className="font-mono text-xs mt-1">
                  <span className="font-semibold">Fusionados:</span> {result.merged.join(', ')}
                </p>
                <p className="text-xs mt-1">
                  <span className="font-semibold">Stock total:</span> {result.totalStock} unidades
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
