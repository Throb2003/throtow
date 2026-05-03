-- THROTOW Production-Grade Migration
-- Adds provider status fields, RLS policies, audit logging, and payment persistence
-- Run this in Supabase SQL Editor

-- ============================================
-- SECTION 1: Add Provider Status Fields to Profiles
-- ============================================

-- Add is_online field (driver/mechanic availability)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Add is_on_job field (currently handling a job)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_on_job BOOLEAN DEFAULT false;

-- Add current_location for real-time GPS tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_location JSONB;

-- Add last_seen for tracking online status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Add verification status for drivers/mechanics
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Add current_job_id for linking to active job
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_job_id UUID REFERENCES service_requests(id);

-- ============================================
-- SECTION 2: Create Audit Log Table
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- SECTION 3: Create Payment Table (for M-Pesa persistence)
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) NOT NULL,
  provider_id UUID REFERENCES auth.users(id),
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'mpesa',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  phone_number VARCHAR(20),
  merchant_request_id VARCHAR(100),
  checkout_request_id VARCHAR(100),
  receipt_number VARCHAR(100),
  transaction_date TIMESTAMPTZ,
  result_code VARCHAR(10),
  result_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for payment queries
CREATE INDEX IF NOT EXISTS idx_payments_request_id ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================
-- SECTION 4: Enable Row Level Security
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 5: RLS Policies for Profiles
-- ============================================

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service providers (drivers/mechanics) can view other providers
DROP POLICY IF EXISTS "Providers can view other providers" ON profiles;
CREATE POLICY "Providers can view other providers" ON profiles
  FOR SELECT USING (
    role IN ('driver', 'mechanic') AND is_online = true
  );

-- ============================================
-- SECTION 6: RLS Policies for Service Requests
-- ============================================

-- Customers can view their own requests
DROP POLICY IF EXISTS "Customers can view own requests" ON service_requests;
CREATE POLICY "Customers can view own requests" ON service_requests
  FOR SELECT USING (customer_id = auth.uid());

-- Customers can create requests
DROP POLICY IF EXISTS "Customers can create requests" ON service_requests;
CREATE POLICY "Customers can create requests" ON service_requests
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Customers can update their own pending requests
DROP POLICY IF EXISTS "Customers can update own pending requests" ON service_requests;
CREATE POLICY "Customers can update own pending requests" ON service_requests
  FOR UPDATE USING (
    customer_id = auth.uid() AND status = 'pending'
  );

-- Providers can view available and assigned requests
DROP POLICY IF EXISTS "Providers can view requests" ON service_requests;
CREATE POLICY "Providers can view requests" ON service_requests
  FOR SELECT USING (
    role IN ('driver', 'mechanic', 'admin') OR customer_id = auth.uid()
  );

-- Admins can view all requests
DROP POLICY IF EXISTS "Admins can view all requests" ON service_requests;
CREATE POLICY "Admins can view all requests" ON service_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update any request
DROP POLICY IF EXISTS "Admins can update any request" ON service_requests;
CREATE POLICY "Admins can update any request" ON service_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- SECTION 7: RLS Policies for Jobs
-- ============================================

-- Providers can view their own jobs
DROP POLICY IF EXISTS "Providers can view own jobs" ON jobs;
CREATE POLICY "Providers can view own jobs" ON jobs
  FOR SELECT USING (
    driver_id = auth.uid() OR mechanic_id = auth.uid()
  );

-- Providers can create jobs (when accepting requests)
DROP POLICY IF EXISTS "Providers can create jobs" ON jobs;
CREATE POLICY "Providers can create jobs" ON jobs
  FOR INSERT WITH CHECK (
    driver_id = auth.uid() OR mechanic_id = auth.uid()
  );

-- Providers can update their own jobs
DROP POLICY IF EXISTS "Providers can update own jobs" ON jobs;
CREATE POLICY "Providers can update own jobs" ON jobs
  FOR UPDATE USING (
    driver_id = auth.uid() OR mechanic_id = auth.uid()
  );

-- Customers can view jobs for their requests
DROP POLICY IF EXISTS "Customers can view related jobs" ON jobs;
CREATE POLICY "Customers can view related jobs" ON jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_requests 
      WHERE id = request_id AND customer_id = auth.uid()
    )
  );

-- Admins can view all jobs
DROP POLICY IF EXISTS "Admins can view all jobs" ON jobs;
CREATE POLICY "Admins can view all jobs" ON jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- SECTION 8: RLS Policies for Payments
-- ============================================

-- Customers can view their own payments
DROP POLICY IF EXISTS "Customers can view own payments" ON payments;
CREATE POLICY "Customers can view own payments" ON payments
  FOR SELECT USING (customer_id = auth.uid());

-- Providers can view payments for their jobs
DROP POLICY IF EXISTS "Providers can view related payments" ON payments;
CREATE POLICY "Providers can view related payments" ON payments
  FOR SELECT USING (
    provider_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM service_requests sr
      JOIN jobs j ON j.request_id = sr.id
      WHERE sr.id = payments.request_id 
      AND (j.driver_id = auth.uid() OR j.mechanic_id = auth.uid())
    )
  );

-- Admins can view all payments
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert payments (for M-Pesa callbacks)
DROP POLICY IF EXISTS "Service can insert payments" ON payments;
CREATE POLICY "Service can insert payments" ON payments
  FOR INSERT WITH CHECK (true);

-- Service role can update payments
DROP POLICY IF EXISTS "Service can update payments" ON payments;
CREATE POLICY "Service can update payments" ON payments
  FOR UPDATE USING (true);

-- ============================================
-- SECTION 9: RLS Policies for Audit Logs
-- ============================================

-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert audit logs
DROP POLICY IF EXISTS "Service can insert audit logs" ON audit_logs;
CREATE POLICY "Service can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- SECTION 10: Helper Functions
-- ============================================

-- Function to update provider online status
CREATE OR REPLACE FUNCTION set_provider_online_status(
  p_is_online BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET is_online = p_is_online,
      last_seen = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Function to update provider current location
CREATE OR REPLACE FUNCTION update_provider_location(
  p_location JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET current_location = p_location,
      last_seen = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action VARCHAR,
  p_table_name VARCHAR,
  p_record_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_old_values, p_new_values);
END;
$$;

-- Function to get online providers (for job assignment)
CREATE OR REPLACE FUNCTION get_online_providers(p_role VARCHAR)
RETURNS TABLE (
  id UUID,
  name TEXT,
  current_location JSONB,
  rating NUMERIC,
  total_jobs INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.current_location,
    p.rating,
    p.total_jobs
  FROM profiles p
  WHERE p.role = p_role
    AND p.is_online = true
    AND p.is_on_job = false
  ORDER BY p.rating DESC NULLS LAST, p.total_jobs DESC NULLS LAST;
END;
$$;

-- ============================================
-- SECTION 11: Trigger for Updated At
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for payments table
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SECTION 12: Grant Permissions
-- ============================================

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION set_provider_online_status(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION update_provider_location(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(VARCHAR, VARCHAR, UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_online_providers(VARCHAR) TO authenticated;

-- Grant select on tables for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- ============================================
-- DONE: Migration Complete
-- ============================================