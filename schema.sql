-- KG Interiors Finance Management System - Database Schema
-- Generated: 2025-10-23T15:31:42.466Z
-- PostgreSQL 15+

-- Drop existing tables if needed (for clean installation)
-- Uncomment the following lines if you want to recreate the entire database

-- DROP TABLE IF EXISTS accounts CASCADE;
-- DROP TABLE IF EXISTS activity_logs CASCADE;
-- DROP TABLE IF EXISTS biz_model_milestones CASCADE;
-- DROP TABLE IF EXISTS biz_model_stages CASCADE;
-- DROP TABLE IF EXISTS biz_models CASCADE;
-- DROP TABLE IF EXISTS customer_kyc CASCADE;
-- DROP TABLE IF EXISTS customer_payments CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS documents CASCADE;
-- DROP TABLE IF EXISTS estimation_items CASCADE;
-- DROP TABLE IF EXISTS financial_event_definitions CASCADE;
-- DROP TABLE IF EXISTS payments_out CASCADE;
-- DROP TABLE IF EXISTS project_collaborators CASCADE;
-- DROP TABLE IF EXISTS project_estimations CASCADE;
-- DROP TABLE IF EXISTS project_ledger CASCADE;
-- DROP TABLE IF EXISTS project_status_history CASCADE;
-- DROP TABLE IF EXISTS projects CASCADE;
-- DROP TABLE IF EXISTS purchase_order_status_history CASCADE;
-- DROP TABLE IF EXISTS purchase_orders CASCADE;
-- DROP TABLE IF EXISTS purchase_request_items CASCADE;
-- DROP TABLE IF EXISTS purchase_requests CASCADE;
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS vendor_boq_items CASCADE;
-- DROP TABLE IF EXISTS vendor_boq_status_history CASCADE;
-- DROP TABLE IF EXISTS vendor_boqs CASCADE;
-- DROP TABLE IF EXISTS vendors CASCADE;
-- DROP TABLE IF EXISTS verification_tokens CASCADE;

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE accounts (
    id INTEGER NOT NULL DEFAULT nextval('accounts_id_seq'::regclass),
    user_id INTEGER NOT NULL,
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
    UNIQUE (provider, provider_account_id),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE activity_logs (
    id INTEGER NOT NULL DEFAULT nextval('activity_logs_id_seq'::regclass),
    project_id INTEGER,
    related_entity TEXT,
    related_id INTEGER,
    actor_id INTEGER,
    action TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE biz_model_milestones (
    id INTEGER NOT NULL DEFAULT nextval('biz_model_milestones_id_seq'::regclass),
    biz_model_id INTEGER,
    milestone_code TEXT NOT NULL,
    milestone_name TEXT NOT NULL,
    direction TEXT NOT NULL,
    stage_code TEXT,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    sequence_order INTEGER,
    woodwork_percentage NUMERIC(9,4) DEFAULT 0,
    misc_percentage NUMERIC(9,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    shopping_percentage NUMERIC(5,2) DEFAULT 0,
    UNIQUE (biz_model_id, milestone_code),
    PRIMARY KEY (id),
    FOREIGN KEY (biz_model_id) REFERENCES biz_models(id) ON DELETE CASCADE,
    CHECK ((direction = ANY (ARRAY['inflow'::text, 'outflow'::text])))
);

COMMENT ON COLUMN biz_model_milestones.woodwork_percentage IS 'Cumulative percentage to be collected for woodwork items by this milestone';
COMMENT ON COLUMN biz_model_milestones.misc_percentage IS 'Cumulative percentage to be collected for misc items by this milestone';
COMMENT ON COLUMN biz_model_milestones.shopping_percentage IS 'Cumulative percentage for shopping service items (used in SHOPPING_100 milestone)';

CREATE TABLE biz_model_stages (
    id INTEGER NOT NULL DEFAULT nextval('biz_model_stages_id_seq'::regclass),
    biz_model_id INTEGER,
    stage_code TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (biz_model_id, stage_code),
    PRIMARY KEY (id),
    FOREIGN KEY (biz_model_id) REFERENCES biz_models(id) ON DELETE CASCADE
);

CREATE TABLE biz_models (
    id INTEGER NOT NULL DEFAULT nextval('biz_models_id_seq'::regclass),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    service_charge_percentage NUMERIC(9,4) DEFAULT 0,
    max_service_charge_discount_percentage NUMERIC(9,4) DEFAULT 0,
    status TEXT DEFAULT 'draft'::text,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    design_charge_percentage NUMERIC(9,4),
    max_design_charge_discount_percentage NUMERIC(9,4),
    shopping_charge_percentage NUMERIC(9,4),
    max_shopping_charge_discount_percentage NUMERIC(9,4),
    gst_percentage NUMERIC(9,4),
    UNIQUE (code),
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);

COMMENT ON COLUMN biz_models.status IS 'Status of business model: draft or published. Only published models can be used in projects.';

CREATE TABLE customer_kyc (
    id INTEGER NOT NULL DEFAULT nextval('customer_kyc_id_seq'::regclass),
    customer_id INTEGER,
    document_type TEXT,
    document_url TEXT,
    file_metadata JSONB DEFAULT '{}'::jsonb,
    submitted_by INTEGER,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    finance_approved_by INTEGER,
    finance_approval_status TEXT DEFAULT 'pending'::text,
    finance_approval_at TIMESTAMPTZ,
    remarks TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    FOREIGN KEY (finance_approved_by) REFERENCES users(id),
    CHECK ((finance_approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE customer_payments (
    id INTEGER NOT NULL DEFAULT nextval('customer_payments_in_id_seq'::regclass),
    project_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    milestone_id INTEGER,
    payment_type TEXT NOT NULL,
    amount NUMERIC(20,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT now(),
    mode TEXT NOT NULL DEFAULT 'bank'::text,
    reference_number TEXT NOT NULL,
    remarks TEXT,
    document_url TEXT,
    status TEXT DEFAULT 'pending'::text,
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (milestone_id) REFERENCES biz_model_milestones(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CHECK ((mode = ANY (ARRAY['cash'::text, 'bank'::text, 'cheque'::text, 'upi'::text, 'wallet'::text, 'other'::text]))),
    CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CHECK ((length(payment_type) > 0))
);

COMMENT ON COLUMN customer_payments.milestone_id IS 'Reference to biz_model_milestone - used to determine payment category';
COMMENT ON COLUMN customer_payments.payment_type IS 'Milestone code or ADHOC - used to filter shopping vs regular payments';
COMMENT ON COLUMN customer_payments.amount IS 'Total payment amount (no category split stored)';
COMMENT ON COLUMN customer_payments.document_url IS 'URL to uploaded payment receipt document';
COMMENT ON COLUMN customer_payments.status IS 'Payment status: pending, approved, rejected';

CREATE TABLE customers (
    id INTEGER NOT NULL DEFAULT nextval('customers_id_seq'::regclass),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    credit_limit NUMERIC(18,2) DEFAULT 0,
    kyc_type TEXT,
    business_type TEXT,
    bank_details JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CHECK ((kyc_type = ANY (ARRAY['aadhar'::text, 'pan'::text, 'blank_cheque'::text, 'none'::text]))),
    CHECK ((business_type = ANY (ARRAY['B2B'::text, 'B2C'::text])))
);

COMMENT ON COLUMN customers.kyc_type IS 'Type of KYC document: aadhar, pan, blank_cheque, or none';
COMMENT ON COLUMN customers.business_type IS 'Business type: B2B or B2C';
COMMENT ON COLUMN customers.bank_details IS 'Bank account details: {account_number, ifsc_code, bank_name, branch_name}';

CREATE TABLE documents (
    id INTEGER NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
    related_entity TEXT,
    related_id INTEGER,
    document_type TEXT,
    document_url TEXT,
    version INTEGER DEFAULT 1,
    uploaded_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    remarks TEXT,
    project_id INTEGER NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

COMMENT ON COLUMN documents.related_entity IS 'Entity type: customer, project, payment, vendor';
COMMENT ON COLUMN documents.related_id IS 'ID of the related entity';

CREATE TABLE estimation_items (
    id INTEGER NOT NULL DEFAULT nextval('estimation_items_id_seq'::regclass),
    estimation_id INTEGER,
    room_name VARCHAR(255) NOT NULL,
    category TEXT,
    description TEXT NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'sqft',
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    quantity NUMERIC(18,4) DEFAULT 1,
    unit_price NUMERIC(20,4) DEFAULT 0,
    total NUMERIC(22,2),
    vendor_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    karighar_charges_percentage NUMERIC(5,2) DEFAULT 10,
    discount_percentage NUMERIC(5,2) DEFAULT 0,
    gst_percentage NUMERIC(5,2) DEFAULT 18,
    subtotal NUMERIC(20,2) DEFAULT 0,
    karighar_charges_amount NUMERIC(20,2) DEFAULT 0,
    discount_amount NUMERIC(20,2) DEFAULT 0,
    amount_before_gst NUMERIC(20,2) DEFAULT 0,
    gst_amount NUMERIC(20,2) DEFAULT 0,
    item_total NUMERIC(20,2) DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (estimation_id) REFERENCES project_estimations(id) ON DELETE CASCADE,
    CHECK ((vendor_type = ANY (ARRAY['PI'::text, 'Aristo'::text, 'Other'::text]))),
    CHECK ((category = ANY (ARRAY['woodwork'::text, 'misc_internal'::text, 'misc_external'::text, 'shopping_service'::text]))),
    CHECK ((unit = ANY (ARRAY['sqft'::text, 'no'::text, 'lumpsum'::text])))
);

COMMENT ON COLUMN estimation_items.room_name IS 'Room or section name (e.g., Living Room, Kitchen) - mandatory for organization';
COMMENT ON COLUMN estimation_items.unit IS 'Unit of measurement: sqft (area with width×height), no (count), lumpsum (fixed)';
COMMENT ON COLUMN estimation_items.width IS 'Width dimension - required only when unit = sqft';
COMMENT ON COLUMN estimation_items.height IS 'Height dimension - required only when unit = sqft';
COMMENT ON COLUMN estimation_items.quantity IS 'Quantity - auto-calculated (width × height) for sqft, manual input for no/lumpsum';
COMMENT ON COLUMN estimation_items.karighar_charges_percentage IS 'KG charges percentage - D&C for woodwork, Service charge for misc/shopping';
COMMENT ON COLUMN estimation_items.discount_percentage IS 'Discount percentage on (subtotal + karighar_charges) for woodwork/misc, only on karighar_charges for shopping';
COMMENT ON COLUMN estimation_items.gst_percentage IS 'GST percentage applicable on this item';
COMMENT ON COLUMN estimation_items.subtotal IS 'Quantity × Unit Price';
COMMENT ON COLUMN estimation_items.karighar_charges_amount IS 'Subtotal × karighar_charges_percentage';
COMMENT ON COLUMN estimation_items.discount_amount IS 'Discount amount calculated';
COMMENT ON COLUMN estimation_items.amount_before_gst IS 'Amount after karighar charges and discount, before GST';
COMMENT ON COLUMN estimation_items.gst_amount IS 'GST amount';
COMMENT ON COLUMN estimation_items.item_total IS 'Final item total including all charges and GST';

CREATE TABLE financial_event_definitions (
    id INTEGER NOT NULL DEFAULT nextval('financial_event_definitions_id_seq'::regclass),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    direction TEXT NOT NULL,
    default_percentage NUMERIC(9,4),
    default_trigger_phase TEXT,
    applicable_to TEXT DEFAULT 'project'::text,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (code),
    PRIMARY KEY (id),
    CHECK ((direction = ANY (ARRAY['inflow'::text, 'outflow'::text]))),
    CHECK ((applicable_to = ANY (ARRAY['customer'::text, 'vendor'::text, 'project'::text])))
);

CREATE TABLE payments_out (
    id INTEGER NOT NULL DEFAULT nextval('payments_out_id_seq'::regclass),
    vendor_id INTEGER,
    vendor_boq_id INTEGER,
    project_id INTEGER,
    milestone_id INTEGER,
    payment_stage TEXT,
    amount NUMERIC(20,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT now(),
    mode TEXT,
    reference_number TEXT,
    remarks TEXT,
    expected_percentage NUMERIC(9,4),
    actual_percentage NUMERIC(9,4),
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (vendor_boq_id) REFERENCES vendor_boqs(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (milestone_id) REFERENCES biz_model_milestones(id),
    CHECK ((payment_stage = ANY (ARRAY['advance'::text, 'in_progress'::text, 'handover'::text, 'final'::text, 'other'::text])))
);

CREATE TABLE project_collaborators (
    id INTEGER NOT NULL DEFAULT nextval('project_collaborators_id_seq'::regclass),
    project_id INTEGER,
    user_id INTEGER,
    role TEXT NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (project_id, user_id, role),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK ((role = ANY (ARRAY['estimator'::text, 'sales'::text, 'designer'::text, 'project_manager'::text, 'finance'::text, 'other'::text])))
);

CREATE TABLE project_estimations (
    id INTEGER NOT NULL DEFAULT nextval('project_estimations_id_seq'::regclass),
    project_id INTEGER,
    version INTEGER DEFAULT 1,
    woodwork_value NUMERIC(20,2) DEFAULT 0,
    misc_internal_value NUMERIC(20,2) DEFAULT 0,
    misc_external_value NUMERIC(20,2) DEFAULT 0,
    shopping_service_value NUMERIC(20,2) DEFAULT 0,
    final_value NUMERIC(20,2) DEFAULT 0,
    gst_amount NUMERIC(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'draft'::text,
    requires_approval BOOLEAN DEFAULT false,
    approval_status TEXT DEFAULT 'approved'::text,
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    has_overpayment BOOLEAN DEFAULT false,
    overpayment_amount NUMERIC(20,2) DEFAULT 0.00,
    remarks TEXT,
    ai_metadata JSONB DEFAULT '{}'::jsonb,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    service_charge NUMERIC(20,2),
    discount NUMERIC(20,2),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'locked'::text]))),
    CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

COMMENT ON COLUMN project_estimations.gst_amount IS 'Calculated GST amount based on final_value';
COMMENT ON COLUMN project_estimations.has_overpayment IS 'True if this revision creates overpayment situation';
COMMENT ON COLUMN project_estimations.overpayment_amount IS 'Amount of overpayment if estimation < collected';

CREATE TABLE project_ledger (
    id INTEGER NOT NULL DEFAULT nextval('project_ledger_id_seq'::regclass),
    project_id INTEGER,
    source_table TEXT,
    source_id INTEGER,
    entry_type TEXT,
    amount NUMERIC(20,2) NOT NULL,
    entry_date TIMESTAMPTZ DEFAULT now(),
    remarks TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CHECK ((entry_type = ANY (ARRAY['credit'::text, 'debit'::text])))
);

CREATE TABLE project_status_history (
    id INTEGER NOT NULL DEFAULT nextval('project_status_history_id_seq'::regclass),
    project_id INTEGER,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMPTZ DEFAULT now(),
    remarks TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE projects (
    id INTEGER NOT NULL DEFAULT nextval('projects_id_seq'::regclass),
    project_code TEXT NOT NULL,
    customer_id INTEGER,
    biz_model_id INTEGER,
    base_rate_id INTEGER,
    name TEXT NOT NULL,
    location TEXT,
    stage TEXT DEFAULT 'onboarding'::text,
    status TEXT DEFAULT 'active'::text,
    finance_locked BOOLEAN DEFAULT false,
    sales_order_id TEXT,
    start_date DATE,
    end_date DATE,
    ai_metadata JSONB DEFAULT '{}'::jsonb,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (project_code),
    UNIQUE (sales_order_id),
    PRIMARY KEY (id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (biz_model_id) REFERENCES biz_models(id),
    FOREIGN KEY (base_rate_id) REFERENCES project_base_rates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE project_base_rates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_service_charge_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 50,
    design_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_design_charge_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 50,
    shopping_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_shopping_charge_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 50,
    gst_percentage NUMERIC(5,2) NOT NULL DEFAULT 18,
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    approved_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by INTEGER REFERENCES users(id),
    comments TEXT,
    CHECK (status IN ('requested', 'approved', 'rejected')),
    CHECK (active IN (true, false))
);

CREATE INDEX idx_project_base_rates_project_id ON project_base_rates(project_id);
CREATE INDEX idx_project_base_rates_active ON project_base_rates(project_id, active) WHERE active = true;
CREATE UNIQUE INDEX idx_project_base_rates_one_active ON project_base_rates(project_id) WHERE active = true;

COMMENT ON TABLE project_base_rates IS 'Project-specific base rate configurations with approval workflow';
COMMENT ON COLUMN project_base_rates.active IS 'Only one row can be active per project at a time';
COMMENT ON COLUMN project_base_rates.status IS 'requested: pending approval, approved: approved, rejected: denied';

CREATE TABLE purchase_order_status_history (
    id INTEGER NOT NULL DEFAULT nextval('purchase_order_status_history_id_seq'::regclass),
    purchase_order_id INTEGER,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMPTZ DEFAULT now(),
    remarks TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE purchase_orders (
    id INTEGER NOT NULL DEFAULT nextval('purchase_orders_id_seq'::regclass),
    project_id INTEGER,
    vendor_id INTEGER,
    vendor_boq_id INTEGER,
    po_number TEXT,
    issue_date DATE,
    status TEXT DEFAULT 'draft'::text,
    remarks TEXT,
    total_value NUMERIC(20,2),
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (po_number),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (vendor_boq_id) REFERENCES vendor_boqs(id),
    CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'dispatched'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE purchase_request_items (
    id INTEGER NOT NULL DEFAULT nextval('purchase_request_items_id_seq'::regclass),
    request_id INTEGER,
    estimation_item_id INTEGER,
    description TEXT,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (estimation_item_id) REFERENCES estimation_items(id)
);

CREATE TABLE purchase_requests (
    id INTEGER NOT NULL DEFAULT nextval('purchase_requests_id_seq'::regclass),
    project_id INTEGER,
    estimation_id INTEGER,
    request_number TEXT,
    status TEXT DEFAULT 'draft'::text,
    remarks TEXT,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (request_number),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (estimation_id) REFERENCES project_estimations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'responded'::text, 'cancelled'::text])))
);

CREATE TABLE sessions (
    id INTEGER NOT NULL DEFAULT nextval('sessions_id_seq'::regclass),
    user_id INTEGER,
    expires TIMESTAMPTZ NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    UNIQUE (session_token),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE users (
    id INTEGER NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    email_verified TIMESTAMPTZ,
    image VARCHAR(255),
    role TEXT DEFAULT 'sales'::text,
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (email),
    PRIMARY KEY (id),
    CHECK ((role = ANY (ARRAY['estimator'::text, 'finance'::text, 'sales'::text, 'designer'::text, 'project_manager'::text, 'admin'::text])))
);

CREATE TABLE vendor_boq_items (
    id INTEGER NOT NULL DEFAULT nextval('vendor_boq_items_id_seq'::regclass),
    boq_id INTEGER,
    estimation_item_id INTEGER,
    description TEXT,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    vendor_rate NUMERIC(20,4) DEFAULT 0,
    total NUMERIC(22,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (boq_id) REFERENCES vendor_boqs(id) ON DELETE CASCADE,
    FOREIGN KEY (estimation_item_id) REFERENCES estimation_items(id)
);

CREATE TABLE vendor_boq_status_history (
    id INTEGER NOT NULL DEFAULT nextval('vendor_boq_status_history_id_seq'::regclass),
    vendor_boq_id INTEGER,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMPTZ DEFAULT now(),
    remarks TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (vendor_boq_id) REFERENCES vendor_boqs(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE vendor_boqs (
    id INTEGER NOT NULL DEFAULT nextval('vendor_boqs_id_seq'::regclass),
    project_id INTEGER,
    vendor_id INTEGER,
    purchase_request_id INTEGER,
    boq_code TEXT,
    status TEXT DEFAULT 'draft'::text,
    total_value NUMERIC(20,2) DEFAULT 0,
    margin_percentage NUMERIC(9,4),
    approval_required BOOLEAN DEFAULT false,
    approval_status TEXT DEFAULT 'pending'::text,
    approval_by INTEGER,
    approval_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (boq_code),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (approval_by) REFERENCES users(id),
    CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])))
);

CREATE TABLE vendors (
    id INTEGER NOT NULL DEFAULT nextval('vendors_id_seq'::regclass),
    name TEXT NOT NULL,
    vendor_type TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    credit_limit NUMERIC(20,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CHECK ((vendor_type = ANY (ARRAY['PI'::text, 'Aristo'::text, 'Other'::text])))
);

CREATE TABLE verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    UNIQUE (identifier, token)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX accounts_provider_provider_account_id_key ON public.accounts USING btree (provider, provider_account_id);
CREATE UNIQUE INDEX biz_model_milestones_biz_model_id_milestone_code_key ON public.biz_model_milestones USING btree (biz_model_id, milestone_code);
CREATE INDEX idx_biz_model_milestones_model ON public.biz_model_milestones USING btree (biz_model_id);
CREATE UNIQUE INDEX biz_model_stages_biz_model_id_stage_code_key ON public.biz_model_stages USING btree (biz_model_id, stage_code);
CREATE INDEX idx_biz_model_stages_model ON public.biz_model_stages USING btree (biz_model_id);
CREATE UNIQUE INDEX biz_models_code_key ON public.biz_models USING btree (code);
CREATE INDEX idx_biz_models_code ON public.biz_models USING btree (code);
CREATE INDEX idx_biz_models_status ON public.biz_models USING btree (status);
CREATE INDEX idx_documents_related ON public.documents USING btree (related_entity, related_id);
CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);
CREATE INDEX idx_estimation_items_estimation ON public.estimation_items USING btree (estimation_id);
CREATE UNIQUE INDEX financial_event_definitions_code_key ON public.financial_event_definitions USING btree (code);
CREATE INDEX idx_fin_event_def_code ON public.financial_event_definitions USING btree (code);
CREATE UNIQUE INDEX project_collaborators_project_id_user_id_role_key ON public.project_collaborators USING btree (project_id, user_id, role);
CREATE INDEX idx_estimations_project ON public.project_estimations USING btree (project_id);
CREATE INDEX idx_project_ledger_project ON public.project_ledger USING btree (project_id);
CREATE INDEX idx_projects_biz_model ON public.projects USING btree (biz_model_id);
CREATE INDEX idx_projects_customer ON public.projects USING btree (customer_id);
CREATE INDEX idx_projects_sales_order ON public.projects USING btree (sales_order_id);
CREATE UNIQUE INDEX projects_project_code_key ON public.projects USING btree (project_code);
CREATE UNIQUE INDEX projects_sales_order_id_key ON public.projects USING btree (sales_order_id);
CREATE INDEX idx_purchase_orders_project ON public.purchase_orders USING btree (project_id);
CREATE UNIQUE INDEX purchase_orders_po_number_key ON public.purchase_orders USING btree (po_number);
CREATE INDEX idx_purchase_requests_project ON public.purchase_requests USING btree (project_id);
CREATE UNIQUE INDEX purchase_requests_request_number_key ON public.purchase_requests USING btree (request_number);
CREATE UNIQUE INDEX sessions_session_token_key ON public.sessions USING btree (session_token);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_vendor_boq_items_boq ON public.vendor_boq_items USING btree (boq_id);
CREATE INDEX idx_vendor_boqs_project ON public.vendor_boqs USING btree (project_id);
CREATE UNIQUE INDEX vendor_boqs_boq_code_key ON public.vendor_boqs USING btree (boq_code);
CREATE UNIQUE INDEX verification_tokens_identifier_token_key ON public.verification_tokens USING btree (identifier, token);
