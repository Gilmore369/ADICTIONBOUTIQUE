# RBAC (Role-Based Access Control) System

This module implements the authorization system for Adiction Boutique Suite using role-based access control.

## Overview

The RBAC system defines four roles with specific permissions:

- **Admin**: Full system access
- **Vendedor**: Product management, sales, and client management
- **Cajero**: Point of sale and cash management
- **Cobrador**: Payment collection and client management

## Files

- `permissions.ts` - Defines roles, permissions, and role-permission mappings
- `check-permission.ts` - Permission checking utilities
- `index.ts` - Module exports

## Usage

### In Server Actions

```typescript
'use server'

import { checkPermission, Permission } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function createProduct(formData: FormData) {
  // Check permission first
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }
  
  // Proceed with the action
  const supabase = await createServerClient()
  // ... rest of implementation
}
```

### Check Multiple Permissions

```typescript
import { checkAnyPermission, checkAllPermissions, Permission } from '@/lib/auth'

// Check if user has ANY of the permissions
const canAccessSales = await checkAnyPermission([
  Permission.CREATE_SALE,
  Permission.VOID_SALE
])

// Check if user has ALL of the permissions
const canManageSalesAndProducts = await checkAllPermissions([
  Permission.CREATE_SALE,
  Permission.MANAGE_PRODUCTS
])
```

### Get User Permissions

```typescript
import { getUserPermissions } from '@/lib/auth'

const permissions = await getUserPermissions()
console.log('User has permissions:', permissions)
```

## Roles and Permissions

### Admin
- All permissions (full system access)

### Vendedor (Salesperson)
- `VIEW_DASHBOARD`
- `MANAGE_PRODUCTS`
- `CREATE_SALE`
- `MANAGE_CLIENTS`
- `VIEW_REPORTS`

### Cajero (Cashier)
- `VIEW_DASHBOARD`
- `CREATE_SALE`
- `MANAGE_CASH`

### Cobrador (Collector)
- `VIEW_DASHBOARD`
- `MANAGE_CLIENTS`
- `RECORD_PAYMENT`
- `VIEW_REPORTS`

## Available Permissions

- `VIEW_DASHBOARD` - Access to dashboard
- `MANAGE_PRODUCTS` - Create, update, delete products
- `CREATE_SALE` - Process sales transactions
- `VOID_SALE` - Cancel/void sales (admin only)
- `MANAGE_CLIENTS` - Create, update, delete clients
- `RECORD_PAYMENT` - Process payments
- `RESCHEDULE_INSTALLMENT` - Reschedule payment installments
- `MANAGE_CASH` - Manage cash register
- `VIEW_REPORTS` - Access reports
- `MANAGE_USERS` - Manage user accounts (admin only)

## Database Schema

The RBAC system expects a `users` table with the following structure:

```sql
CREATE TABLE users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  roles TEXT[] DEFAULT ARRAY['vendedor'],
  stores TEXT[] DEFAULT ARRAY['Mujeres'],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Security Notes

1. **Server-side only**: Permission checks must be performed on the server (Server Actions, API Routes)
2. **Row Level Security**: RLS policies in the database provide an additional security layer
3. **Multiple roles**: Users can have multiple roles; they get the union of all permissions
4. **Fail-safe**: If user is not found or has no roles, all permission checks return `false`

## Testing

When writing tests for Server Actions, ensure you test:

1. Successful operations with correct permissions
2. Rejection with insufficient permissions (403 Forbidden)
3. Rejection when not authenticated (401 Unauthorized)

Example test structure:

```typescript
describe('createProduct', () => {
  it('should create product with MANAGE_PRODUCTS permission', async () => {
    // Mock user with vendedor role
    // Call createProduct
    // Expect success
  })
  
  it('should reject without MANAGE_PRODUCTS permission', async () => {
    // Mock user with cajero role (no MANAGE_PRODUCTS)
    // Call createProduct
    // Expect error: 'Forbidden'
  })
})
```

## Requirements Validation

This implementation satisfies:

- **Requirement 3.1**: Four roles with specific permissions
- **Requirement 3.4**: Unauthorized action rejection with 403 error
- **Requirement 19.2**: Server-side authorization checks

## Next Steps

After implementing RBAC:

1. Add permission checks to all Server Actions
2. Implement unit tests for permission checking (Task 4.4)
3. Write property-based tests for unauthorized actions (Task 4.5)
4. Update UI components to show/hide features based on permissions
