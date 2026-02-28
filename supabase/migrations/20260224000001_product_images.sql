-- ============================================================================
-- Migration: product_images
-- Stores images for product models, keyed by base_code.
-- Supports model-level images (color IS NULL) and per-color images.
-- ============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.product_images (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_code     TEXT        NOT NULL,           -- Logical grouping key (matches products.base_code)
  product_id    UUID        REFERENCES public.products(id) ON DELETE SET NULL,  -- Optional FK
  color         TEXT        NULL,               -- NULL = model-level image, non-null = color variant
  is_primary    BOOLEAN     NOT NULL DEFAULT FALSE,
  storage_bucket TEXT       NOT NULL DEFAULT 'product-images',
  storage_path  TEXT        NOT NULL,           -- Exact path inside bucket
  public_url    TEXT        NULL,               -- Cached public URL
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_images_base_code
  ON public.product_images (base_code);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON public.product_images (product_id);

-- 3. Enforce ONE primary per model (color IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary_model
  ON public.product_images (base_code)
  WHERE is_primary = TRUE AND color IS NULL;

-- 4. Enforce ONE primary per model+color
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary_color
  ON public.product_images (base_code, color)
  WHERE is_primary = TRUE AND color IS NOT NULL;

-- 5. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_product_images_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_images_updated_at ON public.product_images;
CREATE TRIGGER trg_product_images_updated_at
  BEFORE UPDATE ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.set_product_images_updated_at();

-- 6. RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "product_images_select" ON public.product_images;
DROP POLICY IF EXISTS "product_images_insert" ON public.product_images;
DROP POLICY IF EXISTS "product_images_update" ON public.product_images;
DROP POLICY IF EXISTS "product_images_delete" ON public.product_images;

-- Read: any authenticated user
CREATE POLICY "product_images_select"
  ON public.product_images FOR SELECT
  TO authenticated
  USING (TRUE);

-- Insert/Update/Delete: admins + managers only
CREATE POLICY "product_images_insert"
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Vendedor') OR public.has_role('Admin'));

CREATE POLICY "product_images_update"
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.has_role('Admin'));

CREATE POLICY "product_images_delete"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.has_role('Admin'));

-- 7. Supabase Storage bucket (idempotent — run from Dashboard if bucket doesn't exist)
-- Bucket name: "product-images" (PUBLIC)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('product-images', 'product-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- Validation query (comment out in production)
-- SELECT 'product_images table created' AS status;
-- SELECT COUNT(*) FROM public.product_images;
