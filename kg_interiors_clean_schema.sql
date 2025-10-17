--
-- KG Interiors Finance Management System - Clean Database Schema
-- PostgreSQL 15+
-- Generated: June 2025
--

-- Drop existing tables if they exist (optional - uncomment if needed)
-- DROP TABLE IF EXISTS ... CASCADE;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ============================================================================
-- AUTHENTICATION & USER MANAGEMENT (NextAuth.js)
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified TIMESTAMPTZ,
    image VARCHAR(255),
    role TEXT DEFAULT 'sales' CHECK (role IN ('estimator', 'finance', 'sales', 'designer', 'project_manager', 'admin')),
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    UNIQUE(identifier, token)
);

-- ============================================================================
-- BUSINESS MODELS & MILESTONES
-- ============================================================================

CREATE TABLE biz_models (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    service_charge_percentage NUMERIC(9,4) DEFAULT 0,
    max_discount_percentage NUMERIC(9,4) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN biz_models.status IS 'Status of business model: draft or published. Only published models can be used in projects.';

CREATE TABLE biz_model_stages (
    id SERIAL PRIMARY KEY,
    biz_model_id INTEGER REFERENCES biz_models(id) ON DELETE CASCADE,
    stage_code TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(biz_model_id, stage_code)
);

CREATE TABLE biz_model_milestones (
    id SERIAL PRIMARY KEY,
    biz_model_id INTEGER REFERENCES biz_models(id) ON DELETE CASCADE,
    milestone_code TEXT NOT NULL,
    milestone_name TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
    stage_code TEXT,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    sequence_order INTEGER,
    woodwork_percentage NUMERIC(9,4) DEFAULT 0,
    misc_percentage NUMERIC(9,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(biz_model_id, milestone_code)
);

COMMENT ON COLUMN biz_model_milestones.woodwork_percentage IS 'Cumulative percentage to be collected for woodwork items by this milestone';
COMMENT ON COLUMN biz_model_milestones.misc_percentage IS 'Cumulative percentage to be collected for misc items by this milestone';

-- ============================================================================
-- CUSTOMERS & KYC
-- ============================================================================

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    credit_limit NUMERIC(18,2) DEFAULT 0,
    kyc_type TEXT CHECK (kyc_type IN ('aadhar', 'pan', 'blank_cheque', 'none')),
    business_type TEXT CHECK (business_type IN ('B2B', 'B2C')),
    bank_details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN customers.kyc_type IS 'Type of KYC document: aadhar, pan, blank_cheque, or none';
COMMENT ON COLUMN customers.business_type IS 'Business type: B2B or B2C';
COMMENT ON COLUMN customers.bank_details IS 'Bank account details: {account_number, ifsc_code, bank_name, branch_name}';

CREATE TABLE customer_kyc (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    document_type TEXT,
    document_url TEXT,
    file_metadata JSONB DEFAULT '{}',
    submitted_by INTEGER REFERENCES users(id),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    finance_approved_by INTEGER REFERENCES users(id),
    finance_approval_status TEXT DEFAULT 'pending' CHECK (finance_approval_status IN ('pending', 'approved', 'rejected')),
    finance_approval_at TIMESTAMPTZ,
    remarks TEXT
);

-- ============================================================================
-- VENDORS
-- ============================================================================

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    vendor_type TEXT NOT NULL CHECK (vendor_type IN ('PI', 'Aristo', 'Other')),
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    credit_limit NUMERIC(20,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_code TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    biz_model_id INTEGER REFERENCES biz_models(id),
    name TEXT NOT NULL,
    location TEXT,
    phase TEXT DEFAULT 'onboarding' CHECK (phase IN ('onboarding', '2D', '3D', 'execution', 'handover')),
    status TEXT DEFAULT 'active',
    finance_locked BOOLEAN DEFAULT false,
    sales_order_id TEXT UNIQUE,
    start_date DATE,
    end_date DATE,
    invoice_url TEXT,
    revenue_realized NUMERIC(20,2) DEFAULT 0,
    invoice_uploaded_at TIMESTAMPTZ,
    invoice_status TEXT DEFAULT 'pending' CHECK (invoice_status IN ('pending', 'uploaded', 'verified')),
    customer_credit NUMERIC(20,2) DEFAULT 0.00,
    credit_note_url TEXT,
    credit_note_uploaded_at TIMESTAMPTZ,
    ai_metadata JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN projects.invoice_url IS 'URL to uploaded project invoice';
COMMENT ON COLUMN projects.revenue_realized IS 'Revenue realized from this project based on invoice';
COMMENT ON COLUMN projects.invoice_uploaded_at IS 'Timestamp when invoice was uploaded';
COMMENT ON COLUMN projects.customer_credit IS 'Credit balance available to customer due to overpayment';
COMMENT ON COLUMN projects.credit_note_url IS 'URL of the credit note document';

CREATE TABLE project_collaborators (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('estimator', 'sales', 'designer', 'project_manager', 'finance', 'other')),
    permissions JSONB DEFAULT '{}',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id, role)
);

CREATE TABLE project_status_history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT
);

-- ============================================================================
-- ESTIMATIONS & ITEMS
-- ============================================================================

CREATE TABLE project_estimations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    total_value NUMERIC(20,2) DEFAULT 0,
    woodwork_value NUMERIC(20,2) DEFAULT 0,
    misc_internal_value NUMERIC(20,2) DEFAULT 0,
    misc_external_value NUMERIC(20,2) DEFAULT 0,
    service_charge_percentage NUMERIC(9,4) DEFAULT 0,
    service_charge_amount NUMERIC(20,2) DEFAULT 0,
    discount_percentage NUMERIC(9,4) DEFAULT 0,
    discount_amount NUMERIC(20,2) DEFAULT 0,
    final_value NUMERIC(20,2) DEFAULT 0,
    gst_percentage NUMERIC(5,2) DEFAULT 18.00,
    gst_amount NUMERIC(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'locked')),
    requires_approval BOOLEAN DEFAULT false,
    approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    has_overpayment BOOLEAN DEFAULT false,
    overpayment_amount NUMERIC(20,2) DEFAULT 0.00,
    overpayment_status TEXT CHECK (overpayment_status IN ('pending_approval', 'approved', 'rejected') OR overpayment_status IS NULL),
    overpayment_approved_by INTEGER REFERENCES users(id),
    overpayment_approved_at TIMESTAMPTZ,
    overpayment_credit_note_url TEXT,
    remarks TEXT,
    ai_metadata JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN project_estimations.gst_percentage IS 'GST percentage for this estimation (default 18%)';
COMMENT ON COLUMN project_estimations.gst_amount IS 'Calculated GST amount based on final_value';
COMMENT ON COLUMN project_estimations.has_overpayment IS 'True if this revision creates overpayment situation';
COMMENT ON COLUMN project_estimations.overpayment_amount IS 'Amount of overpayment if estimation < collected';

CREATE TABLE estimation_items (
    id SERIAL PRIMARY KEY,
    estimation_id INTEGER REFERENCES project_estimations(id) ON DELETE CASCADE,
    category TEXT CHECK (category IN ('woodwork', 'misc_internal', 'misc_external')),
    description TEXT NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    unit_price NUMERIC(20,4) DEFAULT 0,
    total NUMERIC(22,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    vendor_type TEXT CHECK (vendor_type IN ('PI', 'Aristo', 'Other')),
    estimated_cost NUMERIC(20,2) DEFAULT 0,
    actual_cost NUMERIC(20,2),
    estimated_margin NUMERIC(9,4),
    actual_margin NUMERIC(9,4),
    linked_vendor_boq_item_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCIAL EVENTS & LEDGER
-- ============================================================================

CREATE TABLE financial_event_definitions (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
    default_percentage NUMERIC(9,4),
    default_trigger_phase TEXT,
    applicable_to TEXT DEFAULT 'project' CHECK (applicable_to IN ('customer', 'vendor', 'project')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_financial_events (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    event_definition_id INTEGER REFERENCES financial_event_definitions(id),
    related_entity TEXT,
    related_id INTEGER,
    expected_percentage NUMERIC(9,4),
    expected_amount NUMERIC(20,2),
    actual_amount NUMERIC(20,2),
    triggered_by INTEGER REFERENCES users(id),
    triggered_at TIMESTAMPTZ,
    remarks TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_ledger (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    source_table TEXT,
    source_id INTEGER,
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    entry_type TEXT CHECK (entry_type IN ('credit', 'debit')),
    amount NUMERIC(20,2) NOT NULL,
    entry_date TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT
);

-- ============================================================================
-- CUSTOMER PAYMENTS
-- ============================================================================

CREATE TABLE customer_payments_in (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id INTEGER REFERENCES project_estimations(id),
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    customer_id INTEGER REFERENCES customers(id),
    milestone_id INTEGER REFERENCES biz_model_milestones(id),
    payment_type TEXT NOT NULL CHECK (LENGTH(payment_type) > 0),
    amount NUMERIC(20,2) NOT NULL,
    woodwork_amount NUMERIC(20,2) DEFAULT 0,
    misc_amount NUMERIC(20,2) DEFAULT 0,
    pre_tax_amount NUMERIC(20,2) DEFAULT 0,
    gst_amount NUMERIC(20,2) DEFAULT 0,
    gst_percentage NUMERIC(5,2) DEFAULT 0,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    mode TEXT DEFAULT 'bank' CHECK (mode IN ('cash', 'bank', 'cheque', 'upi', 'wallet', 'other')),
    reference_number TEXT,
    remarks TEXT,
    receipt_url TEXT,
    credit_note_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    expected_percentage NUMERIC(9,4),
    actual_percentage NUMERIC(9,4),
    override_reason TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN customer_payments_in.payment_type IS 'Payment type: milestone code from biz_model_milestones, MISC for ad-hoc payments, or credit_note_reversal for overpayment reversals';
COMMENT ON COLUMN customer_payments_in.receipt_url IS 'URL to uploaded payment receipt document';
COMMENT ON COLUMN customer_payments_in.status IS 'Payment status: pending, approved, rejected';
COMMENT ON COLUMN customer_payments_in.woodwork_amount IS 'Amount allocated to woodwork category';
COMMENT ON COLUMN customer_payments_in.misc_amount IS 'Amount allocated to misc category';
COMMENT ON COLUMN customer_payments_in.pre_tax_amount IS 'Amount before GST (back-calculated from total)';
COMMENT ON COLUMN customer_payments_in.gst_amount IS 'GST amount (back-calculated from total using project GST%)';
COMMENT ON COLUMN customer_payments_in.gst_percentage IS 'GST percentage used for this payment (from estimation)';

-- ============================================================================
-- VENDOR BOQs & PAYMENTS
-- ============================================================================

CREATE TABLE vendor_boqs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id),
    purchase_request_id INTEGER,
    boq_code TEXT UNIQUE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'in_progress', 'completed', 'rejected')),
    total_value NUMERIC(20,2) DEFAULT 0,
    margin_percentage NUMERIC(9,4),
    approval_required BOOLEAN DEFAULT false,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_by INTEGER REFERENCES users(id),
    approval_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vendor_boq_items (
    id SERIAL PRIMARY KEY,
    boq_id INTEGER REFERENCES vendor_boqs(id) ON DELETE CASCADE,
    estimation_item_id INTEGER REFERENCES estimation_items(id),
    description TEXT,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    vendor_rate NUMERIC(20,4) DEFAULT 0,
    total NUMERIC(22,2) GENERATED ALWAYS AS (quantity * vendor_rate) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vendor_boq_status_history (
    id SERIAL PRIMARY KEY,
    vendor_boq_id INTEGER REFERENCES vendor_boqs(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT
);

CREATE TABLE payments_out (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    vendor_boq_id INTEGER REFERENCES vendor_boqs(id),
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    milestone_id INTEGER REFERENCES biz_model_milestones(id),
    payment_stage TEXT CHECK (payment_stage IN ('advance', 'in_progress', 'handover', 'final', 'other')),
    amount NUMERIC(20,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    mode TEXT,
    reference_number TEXT,
    remarks TEXT,
    expected_percentage NUMERIC(9,4),
    actual_percentage NUMERIC(9,4),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PURCHASE ORDERS & REQUESTS
-- ============================================================================

CREATE TABLE purchase_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id INTEGER REFERENCES project_estimations(id),
    request_number TEXT UNIQUE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'responded', 'cancelled')),
    remarks TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES purchase_requests(id) ON DELETE CASCADE,
    estimation_item_id INTEGER REFERENCES estimation_items(id),
    description TEXT,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id),
    vendor_boq_id INTEGER REFERENCES vendor_boqs(id),
    po_number TEXT UNIQUE,
    issue_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'dispatched', 'completed', 'cancelled')),
    remarks TEXT,
    total_value NUMERIC(20,2),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_status_history (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT
);

-- ============================================================================
-- DOCUMENTS MANAGEMENT
-- ============================================================================

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    related_entity TEXT,
    related_id INTEGER,
    document_type TEXT,
    file_url TEXT,
    file_metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Centralized document storage for all entities';
COMMENT ON COLUMN documents.related_entity IS 'Entity type: customer, project, payment, vendor';
COMMENT ON COLUMN documents.related_id IS 'ID of the related entity';

-- ============================================================================
-- ACTIVITY LOGS
-- ============================================================================

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    related_entity TEXT,
    related_id INTEGER,
    actor_id INTEGER REFERENCES users(id),
    action TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- BizModels indexes
CREATE INDEX idx_biz_models_code ON biz_models(code);
CREATE INDEX idx_biz_models_status ON biz_models(status);
CREATE INDEX idx_biz_model_stages_model ON biz_model_stages(biz_model_id);
CREATE INDEX idx_biz_model_milestones_model ON biz_model_milestones(biz_model_id);

-- Projects indexes
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_biz_model ON projects(biz_model_id);
CREATE INDEX idx_projects_sales_order ON projects(sales_order_id);

-- Estimations indexes
CREATE INDEX idx_estimations_project ON project_estimations(project_id);
CREATE INDEX idx_estimation_items_estimation ON estimation_items(estimation_id);

-- Financial indexes
CREATE INDEX idx_project_fin_events_project ON project_financial_events(project_id);
CREATE INDEX idx_project_ledger_project ON project_ledger(project_id);
CREATE INDEX idx_fin_event_def_code ON financial_event_definitions(code);

-- Vendor indexes
CREATE INDEX idx_vendor_boqs_project ON vendor_boqs(project_id);
CREATE INDEX idx_vendor_boq_items_boq ON vendor_boq_items(boq_id);

-- Purchase indexes
CREATE INDEX idx_purchase_requests_project ON purchase_requests(project_id);
CREATE INDEX idx_purchase_orders_project ON purchase_orders(project_id);

-- Documents indexes
CREATE INDEX idx_documents_related ON documents(related_entity, related_id);
CREATE INDEX idx_documents_type ON documents(document_type);

-- ============================================================================
-- DEFAULT DATA (OPTIONAL)
-- ============================================================================

-- You can add default financial event definitions, etc. here if needed
-- Example:
-- INSERT INTO financial_event_definitions (code, name, direction, is_active) 
-- VALUES ('ADV', 'Advance Payment', 'inflow', true);

COMMENT ON SCHEMA public IS 'KG Interiors Finance Management System - Clean Schema';
