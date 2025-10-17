-- Complete Schema Verification and Fix Script
-- Run this to ensure all migrations are applied

-- 1. Check and add columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS kyc_type TEXT CHECK (kyc_type IN ('aadhar', 'pan', 'blank_cheque', 'none')),
ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('B2B', 'B2C')),
ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}'::JSONB;

-- 2. Check and add columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS sales_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS biz_model_id INTEGER REFERENCES biz_models(id),
ADD COLUMN IF NOT EXISTS invoice_url TEXT,
ADD COLUMN IF NOT EXISTS revenue_realized NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invoice_status TEXT CHECK (invoice_status IN ('pending', 'uploaded', 'verified')) DEFAULT 'pending';

-- 3. Check and add columns to project_estimations table
ALTER TABLE project_estimations
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(20,2) DEFAULT 0.00;

-- 4. Check and add columns to customer_payments_in table
ALTER TABLE customer_payments_in
ADD COLUMN IF NOT EXISTS milestone_id INTEGER REFERENCES biz_model_milestones(id),
ADD COLUMN IF NOT EXISTS expected_percentage NUMERIC(9,4),
ADD COLUMN IF NOT EXISTS actual_percentage NUMERIC(9,4),
ADD COLUMN IF NOT EXISTS override_reason TEXT,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS woodwork_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS misc_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pre_tax_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 0;

-- 5. Check and add columns to biz_model_milestones table
ALTER TABLE biz_model_milestones
ADD COLUMN IF NOT EXISTS woodwork_percentage NUMERIC(9,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS misc_percentage NUMERIC(9,4) DEFAULT 0;

-- 6. Create documents table if not exists
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    document_type TEXT CHECK (document_type IN ('kyc_aadhar', 'kyc_pan', 'kyc_cheque', 'payment_receipt', 'project_invoice', 'other')) NOT NULL,
    document_url TEXT NOT NULL,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    related_entity TEXT CHECK (related_entity IN ('customer', 'project', 'payment', 'vendor')) NOT NULL,
    related_id INTEGER NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'::JSONB,
    remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_related ON documents(related_entity, related_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- Verification: List all important columns
SELECT 'customers' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND column_name IN ('kyc_type', 'business_type', 'bank_details')
UNION ALL
SELECT 'projects', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('sales_order_id', 'biz_model_id', 'invoice_url', 'invoice_status')
UNION ALL
SELECT 'project_estimations', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_estimations' 
AND column_name IN ('gst_percentage', 'gst_amount')
UNION ALL
SELECT 'customer_payments_in', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_payments_in' 
AND column_name IN ('milestone_id', 'status', 'woodwork_amount', 'misc_amount', 'pre_tax_amount', 'gst_amount', 'gst_percentage')
UNION ALL
SELECT 'biz_model_milestones', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'biz_model_milestones' 
AND column_name IN ('woodwork_percentage', 'misc_percentage')
ORDER BY table_name, column_name;
