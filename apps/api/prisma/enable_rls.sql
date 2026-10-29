-- =========================================================================
-- FocusAssess Security Hardening Migration: Enable Row Level Security (RLS)
-- Protects PostgreSQL tables against direct Supabase PostgREST anon access
-- =========================================================================

-- 1. Enable RLS on all sensitive tables
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthorizedTeacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Class" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamKeyUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GradingJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GradingResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for table owners (prevents bypass)
ALTER TABLE "Profile" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuthorizedTeacher" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TestCase" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ExamKey" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ExamKeyUsage" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ExamAttempt" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentAnswer" FORCE ROW LEVEL SECURITY;
ALTER TABLE "GradingResult" FORCE ROW LEVEL SECURITY;

-- 3. Policy: Service Role (used by Express API server via Prisma connection pool) has full access
-- PostgreSQL / Prisma connects using the service role or direct connection string with full bypass
-- PostgREST / anon key has NO access by default unless an explicit permissive policy exists.

-- Revoke default public schema permissions from anon and authenticated roles for sensitive tables
REVOKE ALL ON "TestCase" FROM anon, authenticated;
REVOKE ALL ON "ExamKey" FROM anon, authenticated;
REVOKE ALL ON "ExamKeyUsage" FROM anon, authenticated;
REVOKE ALL ON "GradingJob" FROM anon, authenticated;
REVOKE ALL ON "AuditLog" FROM anon, authenticated;
REVOKE ALL ON "AuthorizedTeacher" FROM anon, authenticated;

-- Allow authenticated users to view only their own Profile via direct Supabase client if needed
CREATE POLICY "Users can read own profile" ON "Profile"
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id);

-- Deny all direct client modifications to Profile table (must go through server API)
CREATE POLICY "Prevent direct profile changes" ON "Profile"
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Prevent direct profile inserts" ON "Profile"
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Deny direct access to hidden test cases completely via Supabase PostgREST
CREATE POLICY "Deny anon and authenticated testcase direct access" ON "TestCase"
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Deny direct access to exam access keys completely via Supabase PostgREST
CREATE POLICY "Deny anon and authenticated exam key direct access" ON "ExamKey"
  FOR ALL
  TO anon, authenticated
  USING (false);

