-- Migration: Add notes column to suppliers table
-- Run this in Supabase SQL Editor → https://supabase.com/dashboard/project/mwdqdrqlzlffmfqqcnmp/sql

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN suppliers.notes IS 'Optional notes about the supplier (payment terms, observations, etc.)';
