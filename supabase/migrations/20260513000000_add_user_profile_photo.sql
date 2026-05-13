-- Migration: Add profile photo field to users table
-- Description: Adds profile_photo_url field to store user profile pictures
-- Date: 2026-05-13

-- Add profile_photo_url field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.profile_photo_url IS 'URL of user profile photo stored in Supabase Storage';