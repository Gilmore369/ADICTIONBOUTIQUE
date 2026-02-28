/**
 * Catalog Components Index
 * 
 * Exports all catalog-related components for easy importing
 */

// Base components
export { CatalogTable } from './catalog-table'
export type { CatalogTableColumn } from './catalog-table'
export { CatalogFormDialog } from './catalog-form-dialog'
export { DeleteConfirmationDialog } from './delete-confirmation-dialog'

// Form components
export { LineForm } from './line-form'
export { CategoryForm } from './category-form'
export { BrandForm } from './brand-form'
export { SizeForm } from './size-form'
export { SupplierForm } from './supplier-form'

// Manager components (complete CRUD interfaces)
export { LinesManager } from './lines-manager'
export { CategoriesManager } from './categories-manager'
export { BrandsManager } from './brands-manager'
export { SizesManager } from './sizes-manager'
export { SuppliersManager } from './suppliers-manager'
