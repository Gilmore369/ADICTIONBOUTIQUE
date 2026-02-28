-- Migration: Extend clients table with new fields for CRM functionality
-- Task: 1.6 Extend clients table with new fields
-- Requirements: 2.1, 3.2, 4.1, 5.5

-- Add new columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_purchase_date DATE,
  ADD COLUMN IF NOT EXISTS rating TEXT CHECK (rating IN ('A', 'B', 'C', 'D')),
  ADD COLUMN IF NOT EXISTS rating_score INTEGER CHECK (rating_score >= 0 AND rating_score <= 100),
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT CHECK (deactivation_reason IN ('FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO')),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES auth.users(id);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_clients_last_purchase_date ON clients(last_purchase_date);
CREATE INDEX IF NOT EXISTS idx_clients_rating ON clients(rating);
CREATE INDEX IF NOT EXISTS idx_clients_birthday ON clients(birthday);

-- Add comment to document the purpose of new fields
COMMENT ON COLUMN clients.last_purchase_date IS 'Date of the most recent purchase by the client';
COMMENT ON COLUMN clients.rating IS 'Client rating category (A=Excellent, B=Good, C=Regular, D=Poor)';
COMMENT ON COLUMN clients.rating_score IS 'Numeric rating score from 0-100';
COMMENT ON COLUMN clients.deactivation_reason IS 'Reason for client deactivation';
COMMENT ON COLUMN clients.deactivated_at IS 'Timestamp when client was deactivated';
COMMENT ON COLUMN clients.deactivated_by IS 'User ID who deactivated the client';
