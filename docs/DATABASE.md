# Database Documentation

## Overview

This document describes the PostgreSQL database schema for the Adiction Boutique Suite Supabase migration. The database consists of 19 tables organized by domain, with Row Level Security (RLS) policies enforcing role-based access control.

## Database Architecture

**Database:** PostgreSQL 15+ (Supabase)  
**Extensions:** `uuid-ossp`, `pg_trgm` (trigram indexing for full-text search)  
**Security:** Row Level Security (RLS) enabled on all tables  
**Transactions:** ACID compliance with atomic operations via database functions

---

## Schema Overview

### Domain Organization

**Configuration:**
- `users` - User accounts with roles and store assignments
- `audit_log` - Audit trail for all operations

**Catalog:**
- `lines` - Product lines (e.g., Damas, Caballeros)
- `categories` - Product categories within lines
- `brands` - Product brands
- `sizes` - Size catalog by category
- `suppliers` - Supplier information
- `products` - Product catalog with pricing

**Inventory:**
- `stock` - Current stock by warehouse and product
- `movements` - Stock movement history

**Client:**
- `clients` - Client information with geolocation and credit limits

**Sales:**
- `sales` - Sale headers
- `sale_items` - Sale line items

**Credit:**
- `credit_plans` - Credit plan headers
- `installments` - Individual installment records
- `payments` - Payment records

**Collections:**
- `collection_actions` - Collection activity log

**Cash:**
- `cash_shifts` - Cash register shifts
- `cash_expenses` - Cash expenses

---

## Table Definitions

### users

Extends Supabase `auth.users` with application-specific fields.

**Purpose:** Store user profiles with role-based permissions and store assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, REFERENCES auth.users | User ID from Supabase Auth |
| email | TEXT | UNIQUE, NOT NULL | User email address |
| name | TEXT | NOT NULL | User full name |
| roles | TEXT[] | DEFAULT ARRAY['vendedor'] | User roles (admin, vendedor, cajero, cobrador) |
| stores | TEXT[] | DEFAULT ARRAY['Mujeres'] | Assigned stores/warehouses |
| active | BOOLEAN | DEFAULT true | Account active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `email`

**RLS Policies:**
- Users can view their own profile
- Only admins can manage users

---

### products

Product catalog with pricing and inventory details.

**Purpose:** Store all product information including pricing, categorization, and inventory thresholds.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Product ID |
| barcode | TEXT | UNIQUE | Product barcode (unique identifier) |
| name | TEXT | NOT NULL | Product name |
| description | TEXT | | Product description |
| line_id | UUID | REFERENCES lines(id) | Product line |
| category_id | UUID | REFERENCES categories(id) | Product category |
| brand_id | UUID | REFERENCES brands(id) | Product brand |
| supplier_id | UUID | REFERENCES suppliers(id) | Primary supplier |
| size | TEXT | | Product size |
| color | TEXT | | Product color |
| presentation | TEXT | | Product presentation/packaging |
| purchase_price | DECIMAL(10,2) | | Purchase price from supplier |
| price | DECIMAL(10,2) | NOT NULL | Sale price |
| min_stock | INTEGER | DEFAULT 0 | Minimum stock threshold |
| entry_date | DATE | | Date product entered catalog |
| image_url | TEXT | | Product image URL (Supabase Storage) |
| active | BOOLEAN | DEFAULT true | Product active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `barcode`
- GIN index on `name` using `gin_trgm_ops` (full-text search)
- B-tree index on `barcode`
- B-tree index on `line_id`
- B-tree index on `category_id`

**Business Rules:**
- Barcode must be unique across all products
- Price must be positive
- Soft delete: set `active = false` instead of DELETE

**RLS Policies:**
- All authenticated users can view active products
- Only admins and vendedores can create/update products
- Only admins can delete products

---

### stock

Current stock levels by warehouse and product.

**Purpose:** Track real-time inventory levels across multiple warehouses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Stock record ID |
| warehouse_id | TEXT | NOT NULL | Warehouse/store identifier |
| product_id | UUID | REFERENCES products(id) | Product ID |
| quantity | INTEGER | DEFAULT 0 | Current stock quantity |
| last_updated | TIMESTAMPTZ | DEFAULT NOW() | Last stock update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `(warehouse_id, product_id)`
- B-tree index on `warehouse_id`
- B-tree index on `product_id`

**Business Rules:**
- One stock record per warehouse-product combination
- Quantity updated atomically via `decrement_stock()` function
- Never allow negative stock

**RLS Policies:**
- Users can view stock for their assigned stores
- Only admins and vendedores can update stock

---

### clients

Client information with credit management and geolocation.

**Purpose:** Store customer data including credit limits and geographic coordinates for collection routing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Client ID |
| dni | TEXT | UNIQUE | National ID number |
| name | TEXT | NOT NULL | Client full name |
| phone | TEXT | | Phone number |
| email | TEXT | | Email address |
| address | TEXT | | Physical address |
| lat | DECIMAL(10,8) | | Latitude coordinate |
| lng | DECIMAL(11,8) | | Longitude coordinate |
| credit_limit | DECIMAL(10,2) | DEFAULT 0 | Maximum credit allowed |
| credit_used | DECIMAL(10,2) | DEFAULT 0 | Current credit used (sum of unpaid installments) |
| dni_photo_url | TEXT | | DNI photo URL (Supabase Storage) |
| client_photo_url | TEXT | | Client photo URL (Supabase Storage) |
| birthday | DATE | | Client birthday |
| active | BOOLEAN | DEFAULT true | Client active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `dni`
- GIN index on `name` using `gin_trgm_ops` (full-text search)
- B-tree index on `dni`

**Business Rules:**
- DNI must be unique if provided
- `credit_used` must never exceed `credit_limit`
- `credit_used` updated atomically via `increment_credit_used()` function
- Soft delete: set `active = false`

**RLS Policies:**
- All authenticated users can view clients
- Admins, vendedores, and cobradores can create/update clients

---

### sales

Sale transaction headers.

**Purpose:** Store sale metadata and totals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Sale ID |
| sale_number | TEXT | UNIQUE, NOT NULL | Unique sale number (e.g., V-1234567890) |
| store_id | TEXT | NOT NULL | Store/warehouse where sale occurred |
| client_id | UUID | REFERENCES clients(id) | Client ID (NULL for CONTADO sales) |
| user_id | UUID | REFERENCES users(id) | User who created the sale |
| sale_type | TEXT | NOT NULL | 'CONTADO' or 'CREDITO' |
| subtotal | DECIMAL(10,2) | NOT NULL | Subtotal before discount |
| discount | DECIMAL(10,2) | DEFAULT 0 | Discount amount |
| total | DECIMAL(10,2) | NOT NULL | Final total (subtotal - discount) |
| payment_status | TEXT | DEFAULT 'PENDING' | 'PAID', 'PENDING', 'PARTIAL' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Sale creation timestamp |
| voided | BOOLEAN | DEFAULT false | Sale voided status |
| void_reason | TEXT | | Reason for voiding |
| void_user_id | UUID | REFERENCES users(id) | User who voided the sale |
| void_at | TIMESTAMPTZ | | Void timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `sale_number`
- B-tree index on `client_id`
- B-tree index on `store_id`
- B-tree index on `created_at`

**Business Rules:**
- CONTADO sales: `client_id` is NULL, `payment_status` = 'PAID'
- CREDITO sales: `client_id` required, creates credit plan
- Only admins can void sales
- Voiding does NOT restore stock (manual adjustment required)

**RLS Policies:**
- Users can view sales from their assigned stores
- All authenticated users can create sales
- Only admins can void sales

---

### sale_items

Individual line items for each sale.

**Purpose:** Store product details for each item in a sale.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Sale item ID |
| sale_id | UUID | REFERENCES sales(id) ON DELETE CASCADE | Parent sale ID |
| product_id | UUID | REFERENCES products(id) | Product ID |
| quantity | INTEGER | NOT NULL | Quantity sold |
| unit_price | DECIMAL(10,2) | NOT NULL | Price per unit at time of sale |
| subtotal | DECIMAL(10,2) | NOT NULL | Line total (quantity × unit_price) |

**Indexes:**
- PRIMARY KEY on `id`
- B-tree index on `sale_id`
- B-tree index on `product_id`

**Business Rules:**
- Cascade delete when parent sale is deleted
- `unit_price` captures price at time of sale (historical record)
- `subtotal` = `quantity` × `unit_price`

---

### credit_plans

Credit plan headers for CREDITO sales.

**Purpose:** Store credit plan metadata and installment configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Credit plan ID |
| sale_id | UUID | REFERENCES sales(id) | Associated sale ID |
| client_id | UUID | REFERENCES clients(id) | Client ID |
| total_amount | DECIMAL(10,2) | NOT NULL | Total credit amount |
| installments_count | INTEGER | NOT NULL | Number of installments (1-6) |
| installment_amount | DECIMAL(10,2) | NOT NULL | Amount per installment |
| status | TEXT | DEFAULT 'ACTIVE' | 'ACTIVE', 'COMPLETED', 'CANCELLED' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- B-tree index on `sale_id`
- B-tree index on `client_id`

**Business Rules:**
- `installments_count` must be between 1 and 6
- `installment_amount` = `total_amount` / `installments_count`
- Status becomes 'COMPLETED' when all installments are paid

---

### installments

Individual installment records for credit plans.

**Purpose:** Track payment schedule and status for each installment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Installment ID |
| plan_id | UUID | REFERENCES credit_plans(id) ON DELETE CASCADE | Parent credit plan ID |
| installment_number | INTEGER | NOT NULL | Installment sequence number (1, 2, 3...) |
| amount | DECIMAL(10,2) | NOT NULL | Original installment amount |
| due_date | DATE | NOT NULL | Payment due date |
| paid_amount | DECIMAL(10,2) | DEFAULT 0 | Amount paid so far |
| status | TEXT | DEFAULT 'PENDING' | 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE' |
| paid_at | TIMESTAMPTZ | | Full payment timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- B-tree index on `plan_id`
- B-tree index on `due_date`
- B-tree index on `status`

**Business Rules:**
- Due dates are +30 days apart starting from sale date
- Status 'OVERDUE' when `due_date` < current_date AND status = 'PENDING'
- Status 'PARTIAL' when `paid_amount` > 0 AND `paid_amount` < `amount`
- Status 'PAID' when `paid_amount` >= `amount`
- `paid_at` set when status becomes 'PAID'

**Date Validation:**
- All `due_date` values must be valid ISO format (YYYY-MM-DD)
- Never allow undefined or Invalid Date

---

### payments

Payment transaction records.

**Purpose:** Log all payments received from clients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Payment ID |
| client_id | UUID | REFERENCES clients(id) | Client who made payment |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| payment_date | DATE | NOT NULL | Date payment was received |
| user_id | UUID | REFERENCES users(id) | User who recorded payment |
| receipt_url | TEXT | | Receipt image URL (Supabase Storage) |
| notes | TEXT | | Payment notes |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- B-tree index on `client_id`
- B-tree index on `payment_date`

**Business Rules:**
- Amount must be positive
- Payment applied to installments via `oldest_due_first` algorithm
- Payment application logged in `audit_log`

---

### collection_actions

Collection activity log.

**Purpose:** Track all collection efforts (calls, visits, etc.) for audit and follow-up.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Action ID |
| client_id | UUID | REFERENCES clients(id) | Client ID |
| client_name | TEXT | NOT NULL | Client name (denormalized for reporting) |
| action_type | TEXT | NOT NULL | 'LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO' |
| result | TEXT | NOT NULL | 'PROMESA_PAGO', 'SIN_INTENCION', 'NO_RESPONDE', 'PAGO', 'REPROGRAMADO', 'OTRO' |
| payment_promise_date | DATE | | Date client promised to pay |
| notes | TEXT | | Additional notes |
| user_id | UUID | REFERENCES users(id) | User who performed action |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Action timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- B-tree index on `client_id`
- B-tree index on `created_at`

**Business Rules:**
- All collection actions must be logged
- Used for collection effectiveness reporting

---

### audit_log

Comprehensive audit trail for all system operations.

**Purpose:** Track all create, update, delete operations and authentication events for compliance and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Log entry ID |
| timestamp | TIMESTAMPTZ | DEFAULT NOW() | Event timestamp |
| user_id | UUID | REFERENCES users(id) | User who performed action |
| operation | TEXT | NOT NULL | Operation type (create, update, delete, login, etc.) |
| entity_type | TEXT | NOT NULL | Entity type (product, sale, payment, etc.) |
| entity_id | UUID | | Entity ID (if applicable) |
| old_values | JSONB | | Previous values (for updates/deletes) |
| new_values | JSONB | | New values (for creates/updates) |
| ip_address | TEXT | | Client IP address |

**Indexes:**
- PRIMARY KEY on `id`
- B-tree index on `timestamp`
- B-tree index on `user_id`
- B-tree index on `entity_type`

**Business Rules:**
- All CUD operations must be logged
- Authentication events must be logged
- Payment transactions must be logged with full details
- Errors must be logged with stack traces

---

## Database Functions

### decrement_stock()

Atomically decrements stock with row-level locking to prevent race conditions.

**Signature:**
```sql
decrement_stock(
  p_warehouse_id TEXT,
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN
```

**Logic:**
1. Locks stock row with `FOR UPDATE`
2. Checks if sufficient stock available
3. Decrements stock quantity
4. Logs movement to `movements` table
5. Returns true on success, raises exception if insufficient stock

**Usage:**
```sql
SELECT decrement_stock('Mujeres', 'product-uuid', 5);
```

**Concurrency:** Row-level locking prevents race conditions when multiple sales occur simultaneously.

---

### increment_credit_used()

Atomically increments client credit_used.

**Signature:**
```sql
increment_credit_used(
  p_client_id UUID,
  p_amount DECIMAL
) RETURNS BOOLEAN
```

**Logic:**
1. Updates client `credit_used` by adding amount
2. Returns true on success

**Usage:**
```sql
SELECT increment_credit_used('client-uuid', 500.00);
```

---

### create_sale_transaction()

Atomically creates sale with all related records in a single transaction.

**Signature:**
```sql
create_sale_transaction(
  p_sale_number TEXT,
  p_store_id TEXT,
  p_client_id UUID,
  p_user_id UUID,
  p_sale_type TEXT,
  p_subtotal DECIMAL,
  p_discount DECIMAL,
  p_total DECIMAL,
  p_items JSONB,
  p_installments INTEGER
) RETURNS UUID
```

**Logic:**
1. Inserts sale record
2. Inserts sale items
3. Decrements stock for each item (calls `decrement_stock()`)
4. If CREDITO: creates credit plan
5. If CREDITO: creates installments with +30 day spacing
6. If CREDITO: increments client credit_used
7. Returns sale ID

**Transaction:** All operations in single transaction. Rollback on any failure.

**Usage:**
```sql
SELECT create_sale_transaction(
  'V-1234567890',
  'Mujeres',
  'client-uuid',
  'user-uuid',
  'CREDITO',
  500.00,
  10.00,
  490.00,
  '[{"product_id": "uuid", "quantity": 2, "unit_price": 250.00}]'::jsonb,
  3
);
```

---

## Indexes

### Full-Text Search Indexes

**Purpose:** Enable fast name-based searches using trigram similarity.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_name_trgm 
ON products USING gin(name gin_trgm_ops);

CREATE INDEX idx_clients_name_trgm 
ON clients USING gin(name gin_trgm_ops);
```

**Performance:** Enables ILIKE queries with pattern matching in O(log n) time instead of O(n) full table scan.

**Usage:**
```sql
SELECT * FROM products 
WHERE name ILIKE '%blusa%' 
LIMIT 50;
```

### Lookup Indexes

**Purpose:** Optimize foreign key lookups and common query patterns.

```sql
-- Product lookups
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_line ON products(line_id);
CREATE INDEX idx_products_category ON products(category_id);

-- Client lookups
CREATE INDEX idx_clients_dni ON clients(dni);

-- Sale queries
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_sales_store ON sales(store_id);
CREATE INDEX idx_sales_date ON sales(created_at);

-- Installment queries
CREATE INDEX idx_installments_plan ON installments(plan_id);
CREATE INDEX idx_installments_due_date ON installments(due_date);
CREATE INDEX idx_installments_status ON installments(status);

-- Stock queries
CREATE INDEX idx_stock_warehouse_product ON stock(warehouse_id, product_id);
```

---

## Row Level Security (RLS)

### Overview

All tables have RLS enabled to enforce role-based access control at the database level. This provides defense-in-depth security even if application-level checks fail.

### Policy Patterns

#### View Own Profile
```sql
CREATE POLICY "users_view_own" ON users
  FOR SELECT
  USING (auth.uid() = id);
```

**Rationale:** Users can only view their own profile data.

#### View Active Products
```sql
CREATE POLICY "products_view_active" ON products
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);
```

**Rationale:** All authenticated users can view active products. Inactive products hidden from non-admins.

#### Manage Products (Admin/Vendedor Only)
```sql
CREATE POLICY "products_manage" ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );
```

**Rationale:** Only admins and vendedores can create/update/delete products.

#### View Sales from Assigned Stores
```sql
CREATE POLICY "sales_view_own_stores" ON sales
  FOR SELECT
  USING (
    store_id IN (
      SELECT unnest(stores)
      FROM users
      WHERE id = auth.uid()
    )
  );
```

**Rationale:** Users can only view sales from stores they're assigned to. Admins see all stores.

#### Void Sales (Admin Only)
```sql
CREATE POLICY "sales_void_admin_only" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  )
  WITH CHECK (voided = true);
```

**Rationale:** Only admins can void sales. Policy ensures only the `voided` field can be updated.

#### Manage Clients
```sql
CREATE POLICY "clients_manage" ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) 
           OR 'vendedor' = ANY(roles) 
           OR 'cobrador' = ANY(roles))
    )
  );
```

**Rationale:** Admins, vendedores, and cobradores can manage clients. Cajeros cannot.

#### Update Installments (Admin/Cobrador Only)
```sql
CREATE POLICY "installments_update" ON installments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'cobrador' = ANY(roles))
    )
  );
```

**Rationale:** Only admins and cobradores can update installment status and amounts.

### Testing RLS Policies

**Verify policy enforcement:**
```sql
-- Set user context
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid"}';

-- Query should only return authorized data
SELECT * FROM sales;
```

---

## Data Integrity Constraints

### Foreign Key Constraints

All foreign keys enforce referential integrity:

```sql
-- Products reference catalog tables
ALTER TABLE products
  ADD CONSTRAINT fk_products_line 
  FOREIGN KEY (line_id) REFERENCES lines(id);

-- Sales reference clients and users
ALTER TABLE sales
  ADD CONSTRAINT fk_sales_client 
  FOREIGN KEY (client_id) REFERENCES clients(id);

-- Cascade deletes for dependent records
ALTER TABLE sale_items
  ADD CONSTRAINT fk_sale_items_sale 
  FOREIGN KEY (sale_id) REFERENCES sales(id) 
  ON DELETE CASCADE;
```

### Check Constraints

Enforce business rules at database level:

```sql
-- Positive prices
ALTER TABLE products
  ADD CONSTRAINT chk_products_price_positive
  CHECK (price > 0);

-- Valid installment count
ALTER TABLE credit_plans
  ADD CONSTRAINT chk_credit_plans_installments
  CHECK (installments_count BETWEEN 1 AND 6);

-- Non-negative stock
ALTER TABLE stock
  ADD CONSTRAINT chk_stock_quantity_nonnegative
  CHECK (quantity >= 0);

-- Credit used within limit
ALTER TABLE clients
  ADD CONSTRAINT chk_clients_credit_limit
  CHECK (credit_used <= credit_limit);
```

### Unique Constraints

Prevent duplicate records:

```sql
-- Unique barcode
ALTER TABLE products
  ADD CONSTRAINT uq_products_barcode UNIQUE (barcode);

-- Unique DNI
ALTER TABLE clients
  ADD CONSTRAINT uq_clients_dni UNIQUE (dni);

-- One stock record per warehouse-product
ALTER TABLE stock
  ADD CONSTRAINT uq_stock_warehouse_product 
  UNIQUE (warehouse_id, product_id);
```

---

## Performance Optimization

### Query Optimization Tips

1. **Use indexes for searches:**
   ```sql
   -- Good: Uses gin_trgm_ops index
   SELECT * FROM products WHERE name ILIKE '%search%' LIMIT 50;
   
   -- Bad: Full table scan
   SELECT * FROM products WHERE LOWER(name) LIKE '%search%';
   ```

2. **Limit result sets:**
   ```sql
   -- Always use LIMIT for searches
   SELECT * FROM clients WHERE name ILIKE '%maria%' LIMIT 50;
   ```

3. **Use database functions for atomic operations:**
   ```sql
   -- Good: Atomic with locking
   SELECT decrement_stock('Mujeres', 'uuid', 5);
   
   -- Bad: Race condition
   UPDATE stock SET quantity = quantity - 5 WHERE ...;
   ```

4. **Batch operations:**
   ```sql
   -- Good: Single insert with multiple rows
   INSERT INTO products (name, price) VALUES
     ('Product 1', 100),
     ('Product 2', 200),
     ('Product 3', 300);
   
   -- Bad: Multiple individual inserts
   INSERT INTO products (name, price) VALUES ('Product 1', 100);
   INSERT INTO products (name, price) VALUES ('Product 2', 200);
   ```

### Connection Pooling

Supabase provides connection pooling automatically:
- **Transaction mode:** For short-lived transactions
- **Session mode:** For long-lived connections

Use transaction mode for Server Actions and API routes.

---

## Backup and Recovery

### Automated Backups

Supabase provides automated daily backups:
- Retention: 7 days (free tier), 30 days (pro tier)
- Point-in-time recovery available

### Manual Backup

Export database to SQL:
```bash
pg_dump -h db.project.supabase.co -U postgres -d postgres > backup.sql
```

### Restore from Backup

```bash
psql -h db.project.supabase.co -U postgres -d postgres < backup.sql
```

---

## Migration Management

### Migration Files

Located in `supabase/migrations/`:
- `20240101000000_initial_schema.sql` - Create all tables
- `20240101000001_create_indexes.sql` - Create indexes
- `20240101000002_atomic_functions.sql` - Create database functions
- `20240101000003_row_level_security.sql` - Enable RLS and create policies

### Running Migrations

**Local development:**
```bash
supabase db reset
```

**Production:**
```bash
supabase db push
```

### Migration Best Practices

1. **Never modify existing migrations** - Create new migration files
2. **Test migrations locally** before pushing to production
3. **Include rollback scripts** for complex migrations
4. **Document breaking changes** in migration comments

---

## Monitoring and Maintenance

### Query Performance

Monitor slow queries in Supabase dashboard:
- Query execution time
- Index usage
- Table scans

### Database Size

Monitor table sizes:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Index Usage

Check index usage:
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Vacuum and Analyze

PostgreSQL automatically runs VACUUM and ANALYZE. Manual execution:
```sql
VACUUM ANALYZE products;
```

---

## Security Best Practices

1. **Enable RLS on all tables** - Never disable RLS in production
2. **Use parameterized queries** - Prevent SQL injection
3. **Validate all inputs** - Use Zod schemas before database operations
4. **Audit all operations** - Log to `audit_log` table
5. **Rotate credentials** - Change database passwords regularly
6. **Limit connection access** - Use Supabase connection pooler
7. **Monitor failed auth attempts** - Alert on suspicious activity

---

## Troubleshooting

### Common Issues

**Issue:** Slow searches on product names  
**Solution:** Ensure gin_trgm_ops index exists and query uses ILIKE

**Issue:** Deadlocks on stock updates  
**Solution:** Use `decrement_stock()` function with row-level locking

**Issue:** RLS policy blocking legitimate queries  
**Solution:** Check user roles and policy USING clauses

**Issue:** Foreign key constraint violations  
**Solution:** Ensure referenced records exist before insertion

**Issue:** Invalid date errors  
**Solution:** Validate dates with Zod before database operations

---

## Schema Diagram

```
users ──┐
        │
        ├─→ sales ──→ sale_items ──→ products ──→ lines
        │      │                         │         categories
        │      │                         │         brands
        │      └──→ credit_plans ──→ installments suppliers
        │                                │
        └─→ payments ──────────────────┘
        │
        └─→ collection_actions
        
clients ──→ sales
       └──→ credit_plans
       └──→ payments
       └──→ collection_actions

products ──→ stock ──→ movements

audit_log (references all tables)
```

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions Guide](https://supabase.com/docs/guides/database/functions)
