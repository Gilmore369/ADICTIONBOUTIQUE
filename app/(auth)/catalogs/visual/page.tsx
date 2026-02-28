/**
 * Catálogo Visual — vista de tienda interna
 *
 * Muestra todos los modelos como tarjetas con foto, tallas y stock.
 * Permite subir/gestionar imágenes por modelo y color.
 */

import { VisualCatalog } from '@/components/catalogs/visual-catalog'
import Link from 'next/link'
import { ChevronRight, LayoutGrid } from 'lucide-react'

export const metadata = {
  title: 'Catálogo Visual | Adiction Boutique',
  description: 'Vista interna del catálogo de productos con imágenes',
}

export default function VisualCatalogPage() {
  return (
    <div className="space-y-3">

      {/* Header — compact */}
      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Inicio</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Catálogo Visual</span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">Catálogo Visual</h1>
        <span className="text-xs text-muted-foreground">— gestiona imágenes por modelo y color</span>
      </div>

      {/* Catalog — full width, fixed height */}
      <div className="-mx-4 md:-mx-6">
        <VisualCatalog />
      </div>
    </div>
  )
}
