/**
 * Application Constants
 */

/**
 * Performance Configuration
 */
export const PERFORMANCE = {
  DEBOUNCE_DELAY: 300, // ms - for search inputs
  SEARCH_LIMIT: 50,    // Maximum search results
  CACHE_STALE_TIME: {
    CATALOGS: 3600000,  // 1 hour in ms
    PRODUCTS: 300000,   // 5 minutes in ms
  },
} as const;

/**
 * Sale Types
 */
export const SALE_TYPES = {
  CONTADO: 'CONTADO',  // Cash sale, no client required
  CREDITO: 'CREDITO',  // Credit sale, requires client
} as const;

/**
 * Payment Status
 */
export const PAYMENT_STATUS = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
} as const;

/**
 * Installment Status
 */
export const INSTALLMENT_STATUS = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;

/**
 * Credit Plan Configuration
 */
export const CREDIT_PLAN = {
  MIN_INSTALLMENTS: 1,
  MAX_INSTALLMENTS: 6,
  INSTALLMENT_INTERVAL_DAYS: 30,
} as const;

/**
 * Collection Action Types
 */
export const COLLECTION_ACTION_TYPES = {
  LLAMADA: 'LLAMADA',
  VISITA: 'VISITA',
  WHATSAPP: 'WHATSAPP',
  MOTORIZADO: 'MOTORIZADO',
  EMAIL: 'EMAIL',
  OTRO: 'OTRO',
} as const;

/**
 * Collection Action Results
 */
export const COLLECTION_ACTION_RESULTS = {
  PROMESA_PAGO: 'PROMESA_PAGO',
  SIN_INTENCION: 'SIN_INTENCION',
  NO_RESPONDE: 'NO_RESPONDE',
  PAGO: 'PAGO',
  REPROGRAMADO: 'REPROGRAMADO',
  OTRO: 'OTRO',
} as const;

/**
 * User Roles
 */
export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
  CAJERO: 'cajero',
  COBRADOR: 'cobrador',
} as const;

/**
 * Stores/Warehouses
 * Physical store locations - these are the only valid values for warehouse_id and store_id
 */
export const STORES = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
} as const;

export type StoreId = typeof STORES[keyof typeof STORES];

export const STORE_OPTIONS = [
  { value: STORES.MUJERES, label: 'Tienda Mujeres' },
  { value: STORES.HOMBRES, label: 'Tienda Hombres' },
] as const;
