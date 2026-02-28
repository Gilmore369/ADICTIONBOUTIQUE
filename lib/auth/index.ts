/**
 * Auth module exports
 * 
 * Central export point for authentication and authorization utilities
 */

export { Role, Permission, ROLE_PERMISSIONS } from './permissions'
export {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  getUserPermissions
} from './check-permission'
export {
  requireRole,
  requireAdmin,
  requireCRMAccess,
  AuthorizationError
} from './authorization'
