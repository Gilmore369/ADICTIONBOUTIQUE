# API Documentation

## Overview

This document describes all Server Actions and API Routes in the Adiction Boutique Suite Supabase migration. The system uses Next.js 14 Server Actions for mutations and API Routes for queries.

## Authentication

All endpoints require authentication via Supabase JWT tokens. Unauthorized requests return 401. Insufficient permissions return 403.

### Roles and Permissions

- **Admin**: Full access to all operations
- **Vendedor**: Manage products, create sales, manage clients
- **Cajero**: Create sales, manage cash
- **Cobrador**: Record payments, manage clients, view reports

---

## Server Actions

Server Actions handle all data mutations (create, update, delete operations).

### Authentication Actions

#### `login(formData: FormData)`

Authenticates a user with email and password.

**Parameters:**
- `email` (string): User email
- `password` (string): User password

**Returns:**
```typescript
{
  success: boolean
  error?: string
  data?: { user: User }
}
```

**Example:**
```typescript
const formData = new FormData()
formData.append('email', 'user@example.com')
formData.append('password', 'password123')

const result = await login(formData)
if (result.success) {
  // Redirect to dashboard
}
```

---

### Catalog Actions

#### `createLine(formData: FormData)`

Creates a new product line.

**Permissions:** `MANAGE_PRODUCTS`

**Parameters:**
- `name` (string, required): Line name

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: Line
}
```

#### `createCategory(formData: FormData)`

Creates a new product category.

**Permissions:** `MANAGE_PRODUCTS`

**Parameters:**
- `name` (string, required): Category name
- `line_id` (UUID, required): Parent line ID

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: Category
}
```

#### `createBrand(formData: FormData)`

Creates a new brand.

**Permissions:** `MANAGE_PRODUCTS`

**Parameters:**
- `name` (string, required): Brand name

#### `createSupplier(formData: FormData)`

Creates a new supplier.

**Permissions:** `MANAGE_PRODUCTS`

**Parameters:**
- `name` (string, required): Supplier name
- `contact` (string, optional): Contact information
- `phone` (string, optional): Phone number
- `email` (string, optional): Email address

#### `createProduct(formData: FormData)`

Creates a new product.

**Permissions:** `MANAGE_PRODUCTS`

**Parameters:**
- `barcode` (string, required): Unique barcode
- `name` (string, required): Product name
- `description` (string, optional): Product description
- `line_id` (UUID, required): Line ID
- `category_id` (UUID, required): Category ID
- `brand_id` (UUID, optional): Brand ID
- `supplier_id` (UUID, optional): Supplier ID
- `size` (string, optional): Size
- `color` (string, optional): Color
- `purchase_price` (number, optional): Purchase price
- `price` (number, required): Sale price
- `min_stock` (number, optional): Minimum stock level

**Validation:**
- Barcode must be unique
- Price must be positive
- All foreign keys must exist

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: Product
}
```

**Example:**
```typescript
const formData = new FormData()
formData.append('barcode', '123456789')
formData.append('name', 'Blusa Roja')
formData.append('price', '89.90')
formData.append('line_id', 'uuid-here')
formData.append('category_id', 'uuid-here')

const result = await createProduct(formData)
```

#### `updateProduct(id: string, formData: FormData)`

Updates an existing product.

**Permissions:** `MANAGE_PRODUCTS`

**Parameters:** Same as `createProduct` (all optional except those being updated)

#### `deleteProduct(id: string)`

Soft deletes a product (sets `active = false`).

**Permissions:** `MANAGE_PRODUCTS`

---

### Client Actions

#### `createClient(formData: FormData)`

Creates a new client.

**Permissions:** `MANAGE_CLIENTS`

**Parameters:**
- `dni` (string, optional): DNI number (unique)
- `name` (string, required): Client name
- `phone` (string, optional): Phone number
- `email` (string, optional): Email address
- `address` (string, optional): Physical address
- `lat` (number, optional): Latitude coordinate
- `lng` (number, optional): Longitude coordinate
- `credit_limit` (number, optional): Credit limit (default: 0)

**Validation:**
- DNI must be unique if provided
- Credit limit must be non-negative

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: Client
}
```

#### `updateClient(id: string, formData: FormData)`

Updates an existing client.

**Permissions:** `MANAGE_CLIENTS`

#### `deleteClient(id: string)`

Soft deletes a client (sets `active = false`).

**Permissions:** `MANAGE_CLIENTS`

---

### Sales Actions

#### `createSale(formData: FormData)`

Creates a new sale (CONTADO or CREDITO).

**Permissions:** `CREATE_SALE`

**Parameters:**
- `store_id` (string, required): Store/warehouse ID
- `client_id` (UUID, optional): Client ID (required for CREDITO)
- `sale_type` (enum, required): 'CONTADO' or 'CREDITO'
- `items` (JSON string, required): Array of sale items
- `discount` (number, optional): Discount amount
- `installments` (number, optional): Number of installments (1-6, required for CREDITO)

**Sale Item Structure:**
```typescript
{
  product_id: string
  quantity: number
  unit_price: number
}
```

**Business Logic:**
1. Validates stock availability for all items
2. For CREDITO sales: validates credit limit not exceeded
3. Atomically:
   - Creates sale record
   - Creates sale items
   - Decrements stock using `decrement_stock()` function
   - For CREDITO: creates credit plan and installments
   - For CREDITO: increments client `credit_used`

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: {
    sale: Sale
    credit_plan?: CreditPlan
    installments?: Installment[]
  }
}
```

**Example:**
```typescript
const items = [
  { product_id: 'uuid-1', quantity: 2, unit_price: 89.90 },
  { product_id: 'uuid-2', quantity: 1, unit_price: 120.00 }
]

const formData = new FormData()
formData.append('store_id', 'Mujeres')
formData.append('client_id', 'client-uuid')
formData.append('sale_type', 'CREDITO')
formData.append('items', JSON.stringify(items))
formData.append('discount', '10')
formData.append('installments', '3')

const result = await createSale(formData)
```

#### `voidSale(id: string, reason: string)`

Voids a sale (admin only).

**Permissions:** `VOID_SALE` (Admin only)

**Parameters:**
- `id` (UUID): Sale ID
- `reason` (string): Void reason

**Business Logic:**
- Sets `voided = true`
- Records void reason and user
- Does NOT restore stock (manual adjustment required)

---

### Payment Actions

#### `processPayment(formData: FormData)`

Processes a payment using the oldest_due_first algorithm.

**Permissions:** `RECORD_PAYMENT`

**Parameters:**
- `client_id` (UUID, required): Client ID
- `amount` (number, required): Payment amount (must be positive)
- `payment_date` (string, required): Payment date (YYYY-MM-DD format)
- `notes` (string, optional): Payment notes

**Business Logic (oldest_due_first algorithm):**
1. Fetches all unpaid installments for client
2. Sorts by due_date (overdue first, then upcoming)
3. Applies payment to installments in order:
   - If payment >= remaining amount: marks installment as 'paid'
   - If payment < remaining amount: updates paid_amount, status = 'partial'
4. Decrements client `credit_used` by total applied
5. Logs payment to `payments` table
6. Logs transaction to `audit_log`

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: {
    payment: Payment
    applied_installments: Array<{
      installment_id: string
      amount_applied: number
      new_status: string
    }>
  }
}
```

**Example:**
```typescript
const formData = new FormData()
formData.append('client_id', 'client-uuid')
formData.append('amount', '500')
formData.append('payment_date', '2024-01-15')
formData.append('notes', 'Pago en efectivo')

const result = await processPayment(formData)
```

#### `rescheduleInstallment(id: string, newDueDate: string)`

Reschedules an installment to a new due date.

**Permissions:** `RESCHEDULE_INSTALLMENT`

**Parameters:**
- `id` (UUID): Installment ID
- `newDueDate` (string): New due date (YYYY-MM-DD format)

**Business Logic:**
- Updates installment `due_date`
- Logs old and new values to `audit_log`

---

### Collection Actions

#### `createCollectionAction(formData: FormData)`

Records a collection action (call, visit, etc.).

**Permissions:** `RECORD_PAYMENT`

**Parameters:**
- `client_id` (UUID, required): Client ID
- `client_name` (string, required): Client name
- `action_type` (enum, required): 'LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'
- `result` (enum, required): 'PROMESA_PAGO', 'SIN_INTENCION', 'NO_RESPONDE', 'PAGO', 'REPROGRAMADO', 'OTRO'
- `payment_promise_date` (string, optional): Date of payment promise (YYYY-MM-DD)
- `notes` (string, optional): Additional notes

**Returns:**
```typescript
{
  success: boolean
  error?: string | Record<string, string[]>
  data?: CollectionAction
}
```

---

## API Routes

API Routes handle queries and searches.

### Product Search

#### `GET /api/products/search`

Searches products by name or barcode.

**Query Parameters:**
- `q` (string, required): Search query
- `limit` (number, optional): Result limit (default: 50, max: 50)

**Response:**
```typescript
{
  data: Product[]
}
```

**Example:**
```
GET /api/products/search?q=blusa&limit=20
```

**Performance:**
- Uses gin_trgm_ops index for full-text search
- Enforces LIMIT 50 maximum
- Client-side debouncing (300ms) recommended

---

### Client Search

#### `GET /api/clients/search`

Searches clients by name or DNI.

**Query Parameters:**
- `q` (string, required): Search query
- `limit` (number, optional): Result limit (default: 50, max: 50)

**Response:**
```typescript
{
  data: Client[]
}
```

**Example:**
```
GET /api/clients/search?q=maria&limit=20
```

---

### Installments

#### `GET /api/installments/overdue`

Fetches overdue installments.

**Query Parameters:**
- `client_id` (UUID, optional): Filter by client
- `limit` (number, optional): Result limit (default: 50)

**Response:**
```typescript
{
  data: Array<{
    installment: Installment
    client: Client
    plan: CreditPlan
  }>
}
```

#### `GET /api/installments/upcoming`

Fetches upcoming installments (due within 30 days).

**Query Parameters:**
- `client_id` (UUID, optional): Filter by client
- `limit` (number, optional): Result limit (default: 50)

**Response:**
```typescript
{
  data: Array<{
    installment: Installment
    client: Client
    plan: CreditPlan
  }>
}
```

---

## Error Handling

All endpoints return structured error responses:

### Success Response
```typescript
{
  success: true
  data: T
}
```

### Error Response
```typescript
{
  success: false
  error: string | Record<string, string[]>
  code?: string
  details?: any
}
```

### Error Codes

- `FORBIDDEN`: Insufficient permissions (403)
- `VALIDATION_ERROR`: Input validation failed (400)
- `DUPLICATE_BARCODE`: Barcode already exists (400)
- `DUPLICATE_DNI`: DNI already exists (400)
- `INSUFFICIENT_STOCK`: Not enough stock (400)
- `CREDIT_LIMIT_EXCEEDED`: Credit limit exceeded (400)
- `DATABASE_ERROR`: Database operation failed (500)
- `INTERNAL_ERROR`: Unexpected error (500)

### Validation Errors

Field-specific validation errors are returned as an object:

```typescript
{
  success: false,
  error: {
    barcode: ["Barcode is required"],
    price: ["Price must be positive"]
  },
  code: "VALIDATION_ERROR"
}
```

---

## Rate Limiting

API routes implement rate limiting:
- 100 requests per minute per IP
- 429 status code when exceeded

---

## Caching

### React Query Configuration

Client-side caching with React Query:

**Catalog Data (lines, categories, brands, sizes, suppliers):**
- `staleTime`: 1 hour
- Rarely changes, long cache

**Product Data:**
- `staleTime`: 5 minutes
- Changes frequently, shorter cache

**Client Data:**
- `staleTime`: 5 minutes

**Installments/Payments:**
- `staleTime`: 1 minute
- Real-time data, minimal cache

### Cache Invalidation

Server Actions automatically invalidate cache using `revalidatePath()`:

```typescript
// After creating product
revalidatePath('/catalogs/products')

// After processing payment
revalidatePath('/collections/payments')
revalidatePath('/debt/plans')
```

---

## Database Functions

### `decrement_stock(p_warehouse_id, p_product_id, p_quantity)`

Atomically decrements stock with row-level locking.

**Parameters:**
- `p_warehouse_id` (TEXT): Warehouse ID
- `p_product_id` (UUID): Product ID
- `p_quantity` (INTEGER): Quantity to decrement

**Returns:** BOOLEAN (true on success)

**Throws:** Exception if insufficient stock

**Usage:**
```typescript
const { data, error } = await supabase.rpc('decrement_stock', {
  p_warehouse_id: 'Mujeres',
  p_product_id: 'uuid-here',
  p_quantity: 5
})
```

### `increment_credit_used(p_client_id, p_amount)`

Atomically increments client credit_used.

**Parameters:**
- `p_client_id` (UUID): Client ID
- `p_amount` (DECIMAL): Amount to increment

**Returns:** BOOLEAN (true on success)

### `create_sale_transaction(...)`

Atomically creates sale with all related records.

**Parameters:** See `createSale` Server Action

**Returns:** UUID (sale ID)

**Business Logic:**
1. Inserts sale record
2. Inserts sale items
3. Decrements stock for each item
4. For CREDITO: creates credit plan and installments
5. For CREDITO: increments client credit_used

All operations in single transaction - rollback on any failure.

---

## Testing

### Unit Tests

Test individual Server Actions:

```typescript
import { createProduct } from '@/actions/catalogs'

describe('createProduct', () => {
  it('should create product with valid data', async () => {
    const formData = new FormData()
    formData.append('barcode', '123456')
    formData.append('name', 'Test Product')
    formData.append('price', '100')
    
    const result = await createProduct(formData)
    expect(result.success).toBe(true)
  })
})
```

### Integration Tests

Test complete flows:

```typescript
describe('Sale Creation Flow', () => {
  it('should create sale and decrement stock', async () => {
    // Create product with stock
    // Create sale
    // Verify stock decremented
  })
})
```

---

## Security

### Row Level Security (RLS)

All tables have RLS policies enforcing role-based access:

- Users see only data from their assigned stores
- Admins see all data
- Specific operations restricted by role

### Input Sanitization

All inputs validated with Zod schemas before database operations.

### SQL Injection Prevention

All queries use parameterized statements via Supabase client.

---

## Performance Best Practices

1. **Debounce searches**: 300ms delay on client side
2. **Limit results**: Maximum 50 items per query
3. **Use indexes**: All name searches use gin_trgm_ops indexes
4. **Atomic operations**: Use database functions for critical operations
5. **Cache appropriately**: Configure React Query staleTime based on data volatility
6. **Lazy loading**: Use Suspense for data fetching
