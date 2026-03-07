-- Migration: Enhance Client Visits with Payment and Promise Tracking
-- Adds fields to track payments, promises, and link visits to collection actions

-- Add new columns to client_visits
ALTER TABLE public.client_visits
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA')),
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS promise_date DATE,
  ADD COLUMN IF NOT EXISTS promise_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS collection_action_id UUID REFERENCES public.collection_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for collection_action_id
CREATE INDEX IF NOT EXISTS idx_visits_collection_action ON public.client_visits(collection_action_id);

-- Update comments
COMMENT ON COLUMN public.client_visits.payment_amount IS 'Amount paid during visit (if result = Pagó or Abono parcial)';
COMMENT ON COLUMN public.client_visits.payment_method IS 'Payment method used: EFECTIVO, YAPE, PLIN, TRANSFERENCIA, TARJETA';
COMMENT ON COLUMN public.client_visits.payment_proof_url IS 'Photo proof of payment (screenshot or receipt) stored in Supabase Storage';
COMMENT ON COLUMN public.client_visits.promise_date IS 'Date when client promised to pay (if result = Prometió pagar)';
COMMENT ON COLUMN public.client_visits.promise_amount IS 'Amount client promised to pay';
COMMENT ON COLUMN public.client_visits.collection_action_id IS 'Linked collection action record for tracking';
COMMENT ON COLUMN public.client_visits.notes IS 'Additional notes about the visit';
