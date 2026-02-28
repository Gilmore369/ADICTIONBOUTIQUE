// Core CRM Types and Interfaces
// This file contains all TypeScript interfaces and enums for the Client Management CRM system

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Reasons for client deactivation
 */
export enum DeactivationReason {
  FALLECIDO = 'FALLECIDO',
  MUDADO = 'MUDADO',
  DESAPARECIDO = 'DESAPARECIDO',
  OTRO = 'OTRO',
}

/**
 * Types of actions that can be logged for a client
 */
export enum ActionType {
  NOTA = 'NOTA',
  LLAMADA = 'LLAMADA',
  VISITA = 'VISITA',
  MENSAJE = 'MENSAJE',
  REACTIVACION = 'REACTIVACION',
}

/**
 * Types of alerts that can be generated
 */
export enum AlertType {
  BIRTHDAY = 'BIRTHDAY',
  INACTIVITY = 'INACTIVITY',
  INSTALLMENT = 'INSTALLMENT',
  OVERDUE = 'OVERDUE',
}

/**
 * Priority levels for alerts
 */
export enum AlertPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * Client rating categories based on behavior
 */
export enum RatingCategory {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Client rating information
 * Contains the calculated score and category for a client
 */
export interface ClientRating {
  client_id: string
  rating: RatingCategory
  score: number
  payment_punctuality: number
  purchase_frequency: number
  total_purchases: number
  client_tenure_days: number
  last_calculated: Date
}

/**
 * Summary of a client's credit information
 * Aggregates credit limits, usage, and debt information
 */
export interface CreditSummary {
  creditLimit: number
  creditUsed: number
  creditAvailable: number
  totalDebt: number
  overdueDebt: number
  pendingInstallments: number
  overdueInstallments: number
}

/**
 * Purchase record
 * Represents a single purchase transaction
 */
export interface Purchase {
  id: string
  saleNumber: string
  date: Date
  total: number
  saleType: 'CONTADO' | 'CREDITO'
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL'
}

/**
 * Installment with associated credit plan information
 * Includes calculated fields like days overdue
 */
export interface InstallmentWithPlan {
  id: string
  planId: string
  installmentNumber: number
  amount: number
  dueDate: Date
  paidAmount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'
  paidAt: Date | null
  saleNumber: string
  daysOverdue: number
}

/**
 * Client action log entry
 * Records interactions and actions taken with a client
 */
export interface ClientActionLog {
  id: string
  client_id: string
  action_type: ActionType
  description: string
  user_id: string
  created_at: Date
}

/**
 * Collection action record
 * Tracks collection efforts for clients with debt
 */
export interface CollectionAction {
  id: string
  client_id: string
  action_type: string
  description: string
  follow_up_date: Date
  completed: boolean
  completed_at: Date | null
  user_id: string
  created_at: Date
}

/**
 * Complete client profile
 * Aggregates all client-related data in a single view
 */
export interface ClientProfile {
  client: any // Reference to the full client object from database
  creditSummary: CreditSummary
  purchaseHistory: Purchase[]
  creditHistory: any[] // Credit plans from database
  actionLogs: ClientActionLog[]
  collectionActions: CollectionAction[]
  installments: InstallmentWithPlan[]
  rating: ClientRating | null
}

/**
 * Dashboard metrics
 * Aggregated statistics for the CRM dashboard
 */
export interface DashboardMetrics {
  totalActiveClients: number
  totalDeactivatedClients: number
  clientsWithDebt: number
  clientsWithOverdueDebt: number
  inactiveClients: number
  birthdaysThisMonth: number
  pendingCollectionActions: number
  totalOutstandingDebt: number
  totalOverdueDebt: number
}

/**
 * Alert notification
 * Represents an automated alert about a client event
 */
export interface Alert {
  id: string
  type: AlertType
  clientId: string
  clientName: string
  message: string
  priority: AlertPriority
  dueDate: Date | null
  amount: number | null
  createdAt: Date
}

/**
 * Client filters
 * Criteria for filtering and searching clients
 */
export interface ClientFilters {
  debtStatus?: 'AL_DIA' | 'CON_DEUDA' | 'MOROSO'
  daysSinceLastPurchase?: number
  rating?: RatingCategory[]
  birthdayMonth?: number
  status?: 'ACTIVO' | 'INACTIVO' | 'BAJA'
  deactivationReason?: DeactivationReason[]
}
