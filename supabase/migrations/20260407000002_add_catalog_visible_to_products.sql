-- Migration: Add catalog_visible column to products table
-- Run this in Supabase SQL Editor → https://supabase.com/dashboard/project/mwdqdrqlzlffmfqqcnmp/sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS catalog_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN products.catalog_visible IS 'Marks this product/model for display in the visual catalog. Max 50 models recommended.';

-- Optional: create index for faster catalog queries
CREATE INDEX IF NOT EXISTS idx_products_catalog_visible
  ON products (catalog_visible)
  WHERE catalog_visible = true;
