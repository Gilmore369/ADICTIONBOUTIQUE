-- Migration: Add Barcode Field to Products
-- Description: Adds barcode field with unique constraint for product identification
-- Date: 2026-05-03

SET search_path = public, pg_temp;

-- Add barcode column if it doesn't exist (it should already exist from initial schema)
-- This migration ensures the column exists and has proper constraints

-- Check if barcode column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE products ADD COLUMN barcode TEXT;
  END IF;
END $$;

-- Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_barcode_key'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
  END IF;
END $$;

-- Create index for faster barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Add comment
COMMENT ON COLUMN products.barcode IS 'Unique barcode identifier for product scanning. Can be entered manually or scanned with barcode reader.';

-- Note: The barcode field is optional (nullable) to allow products without barcodes
-- When a barcode is provided, it must be unique across all products
