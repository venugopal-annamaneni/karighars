-- Complete Schema Fix - Adds missing fields and removes GST from payments

-- Add missing fields to customer_payments_in
ALTER TABLE customer_payments_in
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS woodwork_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS misc_amount NUMERIC(20,2) DEFAULT 0;

-- Remove GST fields from customer_payments_in (for GST refactoring)
ALTER TABLE customer_payments_in
DROP COLUMN IF EXISTS gst_amount,
DROP COLUMN IF EXISTS is_gst_applicable,
DROP COLUMN IF EXISTS gst_percentage;

-- Add GST fields to project_estimations
ALTER TABLE project_estimations
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(20,2) DEFAULT 0.00;

-- Add invoice_status to projects if not exists
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS invoice_status TEXT CHECK (invoice_status IN ('pending', 'uploaded', 'verified')) DEFAULT 'pending';

COMMENT ON COLUMN customer_payments_in.status IS 'Payment status: pending, approved, rejected';
COMMENT ON COLUMN customer_payments_in.woodwork_amount IS 'Amount allocated to woodwork category';
COMMENT ON COLUMN customer_payments_in.misc_amount IS 'Amount allocated to misc category';
COMMENT ON COLUMN project_estimations.gst_percentage IS 'GST percentage for this estimation (default 18%)';
COMMENT ON COLUMN project_estimations.gst_amount IS 'Calculated GST amount based on final_value';
