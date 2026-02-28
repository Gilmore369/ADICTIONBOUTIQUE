-- Migration: Add base_code and base_name to products table
-- These fields group product variants (by size/color) under a single logical "model".
-- base_code: e.g., "CHA" (barcode prefix used in bulk entry)
-- base_name: e.g., "Chaleco Army" (model name without the " - SIZE" suffix)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS base_code TEXT,
  ADD COLUMN IF NOT EXISTS base_name TEXT;

-- Backfill from existing data:
-- barcode format: "{baseCode}-{sizeName}"  → base_code = everything before last '-SIZE'
-- name format:    "{baseName} - {sizeName}" → base_name = everything before last ' - SIZE'
UPDATE public.products
SET
  base_code = CASE
    WHEN barcode IS NOT NULL AND barcode ~ '.+-.+$'
      THEN regexp_replace(barcode, '-[^-]+$', '')
    ELSE barcode
  END,
  base_name = CASE
    WHEN name IS NOT NULL AND name ~ ' - .+$'
      THEN regexp_replace(name, ' - [^-]+$', '')
    ELSE name
  END
WHERE base_code IS NULL;

-- Index for efficient grouping in Visual Catalog
CREATE INDEX IF NOT EXISTS idx_products_base_code
  ON public.products (base_code)
  WHERE active = true;

-- Validation (comment out after running):
-- SELECT base_code, base_name, COUNT(*) as variants
-- FROM public.products
-- GROUP BY base_code, base_name
-- ORDER BY base_code;
