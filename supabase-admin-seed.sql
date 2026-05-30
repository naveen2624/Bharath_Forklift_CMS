-- ============================================================
-- FIRST-TIME ADMIN USER SETUP
-- Run this AFTER:
--   1. Running supabase-schema.sql
--   2. Creating a user in Supabase → Authentication → Users
-- ============================================================

-- Step 1: Find your auth user ID
-- SELECT id, email FROM auth.users;

-- Step 2: Insert the admin profile (replace values below)
INSERT INTO users (auth_user_id, name, email, role_id)
SELECT
  'REPLACE_WITH_AUTH_USER_ID',   -- from auth.users.id
  'Admin User',                   -- display name
  'admin@bharathforklift.com',    -- must match auth user email
  id
FROM roles
WHERE role_name = 'admin';

-- Step 3: Verify
-- SELECT u.name, u.email, r.role_name
-- FROM users u JOIN roles r ON u.role_id = r.id;
