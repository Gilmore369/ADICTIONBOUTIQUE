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
 * - ADMIN: Full access to all system features
 * - VENDEDOR: Can manage products, create sales, manage clients, and view reports
 * - CAJERO: Can view dashboard, create sales, and manage cash
 * - COBRADOR: Can view dashboard, manage clients, record payments, and view reports
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.VENDEDOR]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_PRODUCTS,
    Permission.CREATE_SALE,
    Permission.MANAGE_CLIENTS,
    Permission.VIEW_REPORTS
  ],
  [Role.CAJERO]: [
    Permission.VIEW_DASHBOARD,
    Permission.CREATE_SALE,
    Permission.MANAGE_CASH
  ],
  [Role.COBRADOR]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_CLIENTS,
    Permission.RECORD_PAYMENT,
    Permission.VIEW_REPORTS
  ]
}
