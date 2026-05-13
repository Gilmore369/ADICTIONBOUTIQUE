/**
 * RBAC (Role-Based Access Control) System
 * 
 * Defines roles, permissions, and their mappings for the Adiction Boutique Suite.
 * This module provides the foundation for authorization checks throughout the application.
 */

/**
 * User roles in the system
 */
export enum Role {
  ADMIN = 'admin',
  VENDEDOR = 'vendedor',
  CAJERO = 'cajero',
  COBRADOR = 'cobrador'
}

/**
 * System permissions
 */
export enum Permission {
  VIEW_DASHBOARD = 'view_dashboard',
  MANAGE_PRODUCTS = 'manage_products',
  CREATE_SALE = 'create_sale',
  VOID_SALE = 'void_sale',
  MANAGE_CLIENTS = 'manage_clients',
  RECORD_PAYMENT = 'record_payment',
  RESCHEDULE_INSTALLMENT = 'reschedule_installment',
  MANAGE_CASH = 'manage_cash',
  VIEW_REPORTS = 'view_reports',
  MANAGE_USERS = 'manage_users'
}

/**
 * Mapping of roles to their allowed permissions
 *
 * Decisión de negocio (2026-05-13):
 * - TODOS los roles tienen acceso a TODO el flujo operativo.
 * - SOLO ADMIN tiene MANAGE_USERS (gestión de usuarios).
 * - Las páginas /admin/logs y /settings tienen su propio gate adminOnly en
 *   el sidebar (no requieren permiso adicional aquí porque ya están bloqueadas
 *   en la UI y son consumidas solo por admins).
 *
 * Resultado:
 *   - admin     → TODO
 *   - vendedor  → TODO menos gestionar usuarios
 *   - cajero    → TODO menos gestionar usuarios
 *   - cobrador  → TODO menos gestionar usuarios
 */
const OPERATIONAL_PERMISSIONS: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.MANAGE_PRODUCTS,
  Permission.CREATE_SALE,
  Permission.VOID_SALE,
  Permission.MANAGE_CLIENTS,
  Permission.RECORD_PAYMENT,
  Permission.RESCHEDULE_INSTALLMENT,
  Permission.MANAGE_CASH,
  Permission.VIEW_REPORTS,
  // NO incluye MANAGE_USERS
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.VENDEDOR]: OPERATIONAL_PERMISSIONS,
  [Role.CAJERO]: OPERATIONAL_PERMISSIONS,
  [Role.COBRADOR]: OPERATIONAL_PERMISSIONS,
}
