-- ============================================================
-- SCHEMA UPDATES FOR KYC, GST, AND DOCUMENT MANAGEMENT
-- ============================================================

-- Add KYC and bank details to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS kyc_type TEXT CHECK (kyc_type IN ('aadhar', 'pan', 'blank_cheque', 'none')),
ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('B2B', 'B2C')),
ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN customers.kyc_type IS 'Type of KYC document: aadhar, pan, blank_cheque, or none';
COMMENT ON COLUMN customers.business_type IS 'Business type: B2B or B2C';
COMMENT ON COLUMN customers.bank_details IS 'Bank account details: {account_number, ifsc_code, bank_name, branch_name}';

-- Add GST fields to customer_payments_in table
ALTER TABLE customer_payments_in
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_gst_applicable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS milestone_id INTEGER REFERENCES biz_model_milestones(id),
ADD COLUMN IF NOT EXISTS expected_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS actual_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS override_reason TEXT;

COMMENT ON COLUMN customer_payments_in.gst_amount IS 'GST amount charged on this payment';
COMMENT ON COLUMN customer_payments_in.is_gst_applicable IS 'Whether GST is applicable for this payment';
COMMENT ON COLUMN customer_payments_in.gst_percentage IS 'GST percentage applied (e.g., 18 for 18%)';
COMMENT ON COLUMN customer_payments_in.receipt_url IS 'URL to uploaded payment receipt document';

-- Add invoice and revenue tracking to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS sales_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS biz_model_id INTEGER REFERENCES biz_models(id),
ADD COLUMN IF NOT EXISTS invoice_url TEXT,
ADD COLUMN IF NOT EXISTS revenue_realized NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_uploaded_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN projects.invoice_url IS 'URL to uploaded project invoice';
COMMENT ON COLUMN projects.revenue_realized IS 'Revenue realized from this project based on invoice';
COMMENT ON COLUMN projects.invoice_uploaded_at IS 'Timestamp when invoice was uploaded';

-- Create documents table if not exists for centralized document management
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

COMMENT ON TABLE documents IS 'Centralized document storage for all entities';
COMMENT ON COLUMN documents.related_entity IS 'Entity type: customer, project, payment, vendor';
COMMENT ON COLUMN documents.related_id IS 'ID of the related entity';
