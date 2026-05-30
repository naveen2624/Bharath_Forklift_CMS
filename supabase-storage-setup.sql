-- ============================================================
-- BHARATH FORKLIFT CMS — Supabase Storage Setup
-- Run this in Supabase SQL Editor after schema setup
-- OR configure via Supabase Dashboard → Storage
-- ============================================================

-- Create storage buckets (if using SQL approach)
-- Note: Supabase recommends creating buckets from the Dashboard UI
-- Go to Storage → New Bucket for each bucket below

-- Buckets needed:
-- 1. "profiles"  — public — for user avatar images
-- 2. "company"   — public — for company logo
-- 3. "uploads"   — public — for product images

-- If you prefer SQL (run with service role):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profiles', 'profiles', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('company',  'company',  true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('uploads',  'uploads',  true, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
-- Allow authenticated users to upload to profiles bucket
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profiles');

CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profiles');

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profiles');

-- Company bucket (admin only write)
CREATE POLICY "Public can read company assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'company');

CREATE POLICY "Authenticated can upload company assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company');

CREATE POLICY "Authenticated can update company assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company');

-- Uploads bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Public can view uploads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'uploads');
