-- Migration: auto-create public.users row on auth.users insert
-- This ensures every Supabase Auth user gets a corresponding public.users row
-- with default roles so that permission checks work out of the box.

-- Function called by trigger
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, roles, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    ARRAY['admin']::TEXT[],   -- default role: admin (boutique owner)
    true
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent: don't overwrite existing rows
  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill: create public.users rows for any existing auth users that don't have one
INSERT INTO public.users (id, email, name, roles, active)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  ARRAY['admin']::TEXT[],
  true
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING;
