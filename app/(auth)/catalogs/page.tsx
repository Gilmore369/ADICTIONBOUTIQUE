/**
 * Catalogs Page
 * 
 * Main page for catalog management (products, lines, categories, etc.)
 */

import { redirect } from 'next/navigation'

export default function CatalogsPage() {
  redirect('/catalogs/products')
}
