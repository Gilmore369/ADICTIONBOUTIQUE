/**
 * Catálogo Visual — vista de tienda interna
 *
 * Muestra todos los modelos como tarjetas con foto, tallas y stock.
 * Permite subir/gestionar imágenes por modelo y color.
 */

import { VisualCatalog } from '@/components/catalogs/visual-catalog'
import Link from 'next/link'
import { ChevronRight, LayoutGrid, Plus, PackagePlus, ShoppingCart } from 'lucide-react'

export const metadata = {
  title: 'Catálogo Visual | Adiction Boutique',
  description: 'Vista interna del catálogo de productos con imágenes',
}

export default function VisualCatalogPage() {
  return (
    <div className="space-y-3">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/catalogs" className="hover:text-foreground transition-colors">Catálogos</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Catálogo Visual</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <LayoutGrid className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight leading-none">Catálogo Visual</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestiona imágenes y variantes de productos</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/catalogs/products"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border bg-background hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Producto</span>
          </Link>
          <Link
            href="/inventory/bulk-entry"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border bg-background hover:bg-muted transition-colors"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ingreso masivo</span>
          </Link>
          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">POS</span>
          </Link>
        </div>
      </div>

      {/* Catalog — full width, fixed height */}
      <div className="-mx-4 md:-mx-6">
        <VisualCatalog />
      </div>
    </div>
  )
}
