import { BulkProductEntryV2 } from '@/components/inventory/bulk-product-entry-v2'

export const metadata = {
  title: 'Ingreso Masivo | Adiction Boutique',
  description: 'Ingreso masivo de productos por proveedor con variantes por talla',
}

export default function BulkEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Ingreso Masivo de Productos</h1>
        <p className="text-sm text-gray-600 mt-1">
          Registra modelos base con variantes por talla de forma rápida
        </p>
      </div>

      <BulkProductEntryV2 />
    </div>
  )
}
