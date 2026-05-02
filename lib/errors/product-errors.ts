/**
 * Catálogo de mensajes de error en español para el módulo de productos.
 *
 * Convierte errores técnicos de Postgres/Supabase en mensajes claros
 * que el usuario final puede entender y accionar.
 *
 * Creado por la auditoría de productos (Fase 5).
 */

export interface ProductErrorContext {
  barcode?: string
  base_code?: string
  name?: string
  size?: string
  color?: string
  field?: string
}

/**
 * Convierte un error de Supabase/Postgres en un mensaje en español.
 *
 * @param error - El error original (puede ser PostgrestError, Error, o string)
 * @param ctx - Contexto opcional (datos del producto que se intentaba guardar)
 */
export function translateProductError(error: any, ctx: ProductErrorContext = {}): string {
  // Extraer mensaje y código del error
  const msg: string = (error?.message || error?.toString() || '').toLowerCase()
  const code: string = error?.code || ''
  const detail: string = (error?.details || '').toLowerCase()

  // 23505 = unique_violation (Postgres)
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('barcode') || detail.includes('barcode')) {
      return ctx.barcode
        ? `Ya existe un producto con el código "${ctx.barcode}". Usa un código diferente o actualiza el producto existente.`
        : 'Ya existe un producto con ese código. Cada código debe ser único.'
    }
    if (msg.includes('stock') && (msg.includes('product_id') || msg.includes('warehouse_id'))) {
      return `Ya existe un registro de stock para este producto en esta tienda. No se puede crear un duplicado.`
    }
    return 'Ya existe un registro con esos datos. Verifica que no estés duplicando información.'
  }

  // 23503 = foreign_key_violation
  if (code === '23503' || msg.includes('foreign key')) {
    if (msg.includes('category')) return 'La categoría seleccionada no existe o fue eliminada.'
    if (msg.includes('line')) return 'La línea seleccionada no existe o fue eliminada.'
    if (msg.includes('brand')) return 'La marca seleccionada no existe o fue eliminada.'
    if (msg.includes('supplier')) return 'El proveedor seleccionado no existe o fue eliminado.'
    if (msg.includes('warehouse')) return 'El almacén/tienda seleccionado no existe.'
    return 'Hay una referencia inválida en los datos. Verifica que línea, categoría, marca y proveedor existan.'
  }

  // 23502 = not_null_violation
  if (code === '23502' || msg.includes('null value') || msg.includes('not null')) {
    const fieldMatch = msg.match(/column "(\w+)"/)
    const field = fieldMatch ? fieldMatch[1] : ctx.field
    const fieldNames: Record<string, string> = {
      barcode: 'código',
      name: 'nombre',
      price: 'precio venta',
      purchase_price: 'precio compra',
      category_id: 'categoría',
      line_id: 'línea',
      brand_id: 'marca',
    }
    return `Falta llenar el campo "${field ? fieldNames[field] || field : 'requerido'}". Es obligatorio.`
  }

  // 23514 = check_violation (constraint CHECK)
  if (code === '23514' || msg.includes('check constraint')) {
    if (msg.includes('quantity') || msg.includes('stock')) return 'La cantidad de stock no puede ser negativa.'
    if (msg.includes('price')) return 'El precio no puede ser negativo.'
    return 'Uno de los valores no cumple las reglas del sistema (verifica precios y cantidades).'
  }

  // Permisos
  if (msg.includes('permission denied') || msg.includes('rls') || msg.includes('policy')) {
    return 'No tienes permisos para realizar esta acción. Contacta al administrador.'
  }

  // Auth
  if (msg.includes('jwt') || msg.includes('auth') || msg.includes('not authenticated')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  }

  // Network / timeout
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')) {
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.'
  }

  // Fallback: devolver mensaje original si nada coincide
  return error?.message || 'Error desconocido al procesar el producto.'
}

/**
 * Mensajes pre-definidos para situaciones comunes de validación
 * (no errores de BD, sino reglas de negocio).
 */
export const PRODUCT_VALIDATION_MESSAGES = {
  BARCODE_REQUIRED: 'El código de barras es obligatorio.',
  BARCODE_TOO_SHORT: 'El código de barras debe tener al menos 3 caracteres.',
  NAME_REQUIRED: 'El nombre del producto es obligatorio.',
  NAME_TOO_SHORT: 'El nombre debe tener al menos 2 caracteres.',
  CATEGORY_REQUIRED: 'Debes seleccionar una categoría.',
  LINE_REQUIRED: 'Debes seleccionar una línea.',
  PRICE_REQUIRED: 'El precio de venta es obligatorio.',
  PRICE_NEGATIVE: 'El precio no puede ser negativo.',
  PRICE_BELOW_COST: 'El precio de venta es menor al precio de compra. ¿Es correcto?',
  STOCK_NEGATIVE: 'El stock no puede ser negativo.',
  STOCK_REQUIRED: 'Debes ingresar la cantidad inicial de stock.',
  WAREHOUSE_REQUIRED: 'Debes seleccionar el almacén/tienda destino.',
  SUPPLIER_REQUIRED: 'Debes seleccionar el proveedor.',
  BRAND_NOT_LINKED: (brand: string, supplier: string) =>
    `La marca "${brand}" no está asociada al proveedor "${supplier}". Asocia la marca al proveedor en Catálogos > Proveedores antes de continuar.`,
  IMAGE_TOO_LARGE: 'La imagen excede el tamaño máximo de 2 MB.',
  IMAGE_INVALID_FORMAT: 'Solo se permiten imágenes JPG, PNG o WEBP.',
  DUPLICATE_IN_BATCH: (code: string, row1: number, row2: number) =>
    `El código "${code}" se repite en las filas ${row1} y ${row2}. Cada código debe ser único en el lote.`,
  DUPLICATE_VARIANT_IN_BATCH: (model: string, size: string, color: string, row1: number, row2: number) =>
    `Variante duplicada en el lote: modelo "${model}", talla "${size || 'sin talla'}", color "${color || 'sin color'}" aparece en filas ${row1} y ${row2}.`,
  REPLACE_REASON_REQUIRED: 'El modo "Reemplazar stock" requiere un motivo claro (mínimo 5 caracteres).',
} as const
