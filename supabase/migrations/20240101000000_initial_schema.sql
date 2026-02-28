-- Migration: Initial Schema with 19 Tables
-- Description: Creates all database tables with foreign keys, constraints, and defaults
-- Requirements: 2.1, 2.2

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Users table (extends Supabase auth.users)
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

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  operation TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT
);

-- ============================================================================
-- CATALOG TABLES
-- ============================================================================

-- Lines table (product lines)
CREATE TABLE lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  line_id UUID REFERENCES lines(id),
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, line_id)
);

-- Brands table
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sizes table
CREATE TABLE sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, category_id)
);

-- Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  line_id UUID REFERENCES lines(id),
  category_id UUID REFERENCES categories(id),
  brand_id UUID REFERENCES brands(id),
  supplier_id UUID REFERENCES suppliers(id),
  size TEXT,
  color TEXT,
  presentation TEXT,
  purchase_price DECIMAL(10,2),
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  entry_date DATE,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INVENTORY TABLES
-- ============================================================================

-- Stock table
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

-- Movements table (stock movement history)
CREATE TABLE movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('ENTRADA', 'SALIDA', 'AJUSTE', 'TRASPASO')),
  quantity INTEGER NOT NULL,
  reference TEXT,
  notes TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CLIENT TABLES
-- ============================================================================

-- Clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dni TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  credit_limit DECIMAL(10,2) DEFAULT 0 CHECK (credit_limit >= 0),
  credit_used DECIMAL(10,2) DEFAULT 0 CHECK (credit_used >= 0),
  dni_photo_url TEXT,
  client_photo_url TEXT,
  birthday DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SALES TABLES
-- ============================================================================

-- Sales table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number TEXT UNIQUE NOT NULL,
  store_id TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  user_id UUID REFERENCES users(id),
  sale_type TEXT NOT NULL CHECK (sale_type IN ('CONTADO', 'CREDITO')),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  discount DECIMAL(10,2) DEFAULT 0 CHECK (discount >= 0),
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN ('PAID', 'PENDING', 'PARTIAL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  voided BOOLEAN DEFAULT false,
  void_reason TEXT,
  void_user_id UUID REFERENCES users(id),
  void_at TIMESTAMPTZ
);

-- Sale items table
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- ============================================================================
-- CREDIT TABLES
-- ============================================================================

-- Credit plans table
CREATE TABLE credit_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id),
  client_id UUID REFERENCES clients(id),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  installments_count INTEGER NOT NULL CHECK (installments_count BETWEEN 1 AND 6),
  installment_amount DECIMAL(10,2) NOT NULL CHECK (installment_amount > 0),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installments table
CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES credit_plans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
  paid_at TIMESTAMPTZ
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  user_id UUID REFERENCES users(id),
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COLLECTION TABLES
-- ============================================================================

-- Collection actions table
CREATE TABLE collection_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  client_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO')),
  result TEXT NOT NULL CHECK (result IN ('PROMESA_PAGO', 'SIN_INTENCION', 'NO_RESPONDE', 'PAGO', 'REPROGRAMADO', 'OTRO')),
  payment_promise_date DATE,
  notes TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CASH TABLES
-- ============================================================================

-- Cash shifts table
CREATE TABLE cash_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  opening_amount DECIMAL(10,2) NOT NULL CHECK (opening_amount >= 0),
  closing_amount DECIMAL(10,2) CHECK (closing_amount >= 0),
  expected_amount DECIMAL(10,2) CHECK (expected_amount >= 0),
  difference DECIMAL(10,2),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED'))
);

-- Cash expenses table
CREATE TABLE cash_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES cash_shifts(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with roles and store assignments';
COMMENT ON TABLE audit_log IS 'Audit trail for all operations';
COMMENT ON TABLE lines IS 'Product lines (e.g., Damas, Caballeros)';
COMMENT ON TABLE categories IS 'Product categories within lines';
COMMENT ON TABLE brands IS 'Product brands';
COMMENT ON TABLE sizes IS 'Size catalog by category';
COMMENT ON TABLE suppliers IS 'Supplier information';
COMMENT ON TABLE products IS 'Product catalog with pricing and details';
COMMENT ON TABLE stock IS 'Current stock by warehouse and product';
COMMENT ON TABLE movements IS 'Stock movement history';
COMMENT ON TABLE clients IS 'Client information with geolocation and credit limits';
COMMENT ON TABLE sales IS 'Sale headers';
COMMENT ON TABLE sale_items IS 'Sale line items';
COMMENT ON TABLE credit_plans IS 'Credit plan headers';
COMMENT ON TABLE installments IS 'Individual installment records';
COMMENT ON TABLE payments IS 'Payment records';
COMMENT ON TABLE collection_actions IS 'Collection activity log';
COMMENT ON TABLE cash_shifts IS 'Cash register shifts';
COMMENT ON TABLE cash_expenses IS 'Cash expenses';
