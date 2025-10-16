-- ============================================================
-- KG INTERIORS ERP — POSTGRES SCHEMA
-- ============================================================

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified TIMESTAMP WITH TIME ZONE,
  image VARCHAR(255),
  role TEXT CHECK (role IN ('estimator','finance','sales','designer','project_manager','admin')) DEFAULT 'sales',
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Accounts table (for OAuth providers)
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

-- Sessions table
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  session_token VARCHAR(255) UNIQUE NOT NULL
);

-- Verification tokens
CREATE TABLE verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(identifier, token)
);

-- ============================================================
-- CUSTOMERS & KYC
-- ============================================================
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    credit_limit NUMERIC(18,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE customer_kyc (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    document_type TEXT,
    document_url TEXT,
    file_metadata JSONB DEFAULT '{}'::JSONB,
    submitted_by INTEGER REFERENCES users(id),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finance_approved_by INTEGER REFERENCES users(id),
    finance_approval_status TEXT CHECK (finance_approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
    finance_approval_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT
);

-- ============================================================
-- PROJECTS & COLLABORATORS
-- ============================================================
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_code TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    name TEXT NOT NULL,
    location TEXT,
    phase TEXT CHECK (phase IN ('onboarding','2D','3D','execution','handover')) DEFAULT 'onboarding',
    status TEXT DEFAULT 'active',
    finance_locked BOOLEAN DEFAULT FALSE,
    ai_metadata JSONB DEFAULT '{}'::JSONB,
    start_date DATE,
    end_date DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE project_collaborators (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    role TEXT CHECK (role IN ('estimator','sales','designer','project_manager','finance','other')) NOT NULL,
    permissions JSONB DEFAULT '{}'::JSONB,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (project_id, user_id, role)
);

CREATE TABLE project_status_history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remarks TEXT
);

-- ============================================================
-- PROJECT ESTIMATIONS & ITEMS
-- ============================================================
CREATE TABLE project_estimations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    total_value NUMERIC(20,2) DEFAULT 0,
    woodwork_value NUMERIC(20,2) DEFAULT 0,
    misc_internal_value NUMERIC(20,2) DEFAULT 0,
    misc_external_value NUMERIC(20,2) DEFAULT 0,
    remarks TEXT,
    status TEXT CHECK (status IN ('draft','finalized','locked')) DEFAULT 'draft',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ai_metadata JSONB DEFAULT '{}'::JSONB
);

CREATE TABLE estimation_items (
    id SERIAL PRIMARY KEY,
    estimation_id INTEGER REFERENCES project_estimations(id) ON DELETE CASCADE,
    category TEXT CHECK (category IN ('woodwork','misc_internal','misc_external')),
    description TEXT NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    unit_price NUMERIC(20,4) DEFAULT 0,
    total NUMERIC(22,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    vendor_type TEXT CHECK (vendor_type IN ('PI','Aristo','Other')),
    estimated_cost NUMERIC(20,2) DEFAULT 0,
    actual_cost NUMERIC(20,2),
    estimated_margin NUMERIC(9,4),
    actual_margin NUMERIC(9,4),
    linked_vendor_boq_item_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    vendor_type TEXT CHECK (vendor_type IN ('PI','Aristo','Other')) NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    credit_limit NUMERIC(20,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vendor_rate_cards (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    item_category TEXT,
    sub_category TEXT,
    unit TEXT,
    rate NUMERIC(20,2),
    effective_from DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- PROCUREMENT FLOW
-- ============================================================
CREATE TABLE purchase_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id INTEGER REFERENCES project_estimations(id),
    request_number TEXT UNIQUE,
    created_by INTEGER REFERENCES users(id),
    status TEXT CHECK (status IN ('draft','sent','responded','cancelled')) DEFAULT 'draft',
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE purchase_request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES purchase_requests(id) ON DELETE CASCADE,
    estimation_item_id INTEGER REFERENCES estimation_items(id),
    description TEXT,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vendor_boqs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    vendor_id INTEGER REFERENCES vendors(id),
    purchase_request_id INTEGER REFERENCES purchase_requests(id),
    boq_code TEXT UNIQUE,
    status TEXT CHECK (status IN ('draft','submitted','approved','in_progress','completed','rejected')) DEFAULT 'draft',
    total_value NUMERIC(20,2) DEFAULT 0,
    margin_percentage NUMERIC(9,4),
    approval_required BOOLEAN DEFAULT FALSE,
    approval_status TEXT CHECK (approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
    approval_by INTEGER REFERENCES users(id),
    approval_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vendor_boq_status_history (
    id SERIAL PRIMARY KEY,
    vendor_boq_id INTEGER REFERENCES vendor_boqs(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remarks TEXT
);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    vendor_id INTEGER REFERENCES vendors(id),
    vendor_boq_id INTEGER REFERENCES vendor_boqs(id),
    po_number TEXT UNIQUE,
    issue_date DATE,
    status TEXT CHECK (status IN ('draft','approved','dispatched','completed','cancelled')) DEFAULT 'draft',
    remarks TEXT,
    total_value NUMERIC(20,2),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE purchase_order_status_history (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remarks TEXT
);

-- ============================================================
-- FINANCIAL EVENT DEFINITIONS
-- ============================================================
CREATE TABLE financial_event_definitions (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    direction TEXT CHECK (direction IN ('inflow','outflow')) NOT NULL,
    default_percentage NUMERIC(9,4),
    default_trigger_phase TEXT,
    applicable_to TEXT CHECK (applicable_to IN ('customer','vendor','project')) DEFAULT 'project',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
    triggered_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    status TEXT CHECK (status IN ('pending','triggered','completed','cancelled')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE customer_payments_in (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    estimation_id INTEGER REFERENCES project_estimations(id),
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    customer_id INTEGER REFERENCES customers(id),
    payment_type TEXT CHECK (payment_type IN ('advance_10','3D_50','misc_100','final','other')),
    amount NUMERIC(20,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    mode TEXT CHECK (mode IN ('cash','bank','cheque','upi','wallet','other')) DEFAULT 'bank',
    reference_number TEXT,
    remarks TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE payments_out (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    vendor_boq_id INTEGER REFERENCES vendor_boqs(id),
    project_id INTEGER REFERENCES projects(id),
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    payment_stage TEXT CHECK (payment_stage IN ('advance','in_progress','handover','final','other')),
    amount NUMERIC(20,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    mode TEXT,
    reference_number TEXT,
    remarks TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE project_ledger (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    wallet_transaction_id BIGINT,
    source_table TEXT,
    source_id INTEGER,
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    entry_type TEXT CHECK (entry_type IN ('credit','debit')),
    amount NUMERIC(20,2) NOT NULL,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remarks TEXT
);

-- ============================================================
-- WALLET SYSTEM
-- ============================================================
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    wallet_code TEXT UNIQUE,
    owner_type TEXT CHECK (owner_type IN ('customer','project','vendor','kg')) NOT NULL,
    owner_id INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    balance NUMERIC(24,2) DEFAULT 0,
    status TEXT CHECK (status IN ('active','suspended','closed')) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX wallets_owner_uq ON wallets (owner_type, owner_id);

CREATE TABLE wallet_transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    tx_type TEXT CHECK (tx_type IN ('credit','debit','transfer','adjustment')) NOT NULL,
    amount NUMERIC(24,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    related_wallet_id INTEGER,
    reference TEXT,
    source_table TEXT,
    source_id INTEGER,
    project_financial_event_id INTEGER REFERENCES project_financial_events(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remarks TEXT
);

-- Trigger for wallet balance sync
CREATE OR REPLACE FUNCTION trg_wallet_balance_update_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tx_type = 'credit' THEN
      UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
    ELSIF NEW.tx_type = 'debit' THEN
      UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    ELSIF NEW.tx_type = 'transfer' THEN
      UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
      IF NEW.related_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.related_wallet_id;
      END IF;
    ELSIF NEW.tx_type = 'adjustment' THEN
      UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_balance_update
AFTER INSERT ON wallet_transactions
FOR EACH ROW EXECUTE FUNCTION trg_wallet_balance_update_fn();

-- ============================================================
-- CREDIT / DEBIT NOTES
-- ============================================================
CREATE TABLE credit_notes (
    id SERIAL PRIMARY KEY,
    note_number TEXT UNIQUE,
    issued_by_type TEXT CHECK (issued_by_type IN ('kg','vendor','customer')),
    issued_by_id INTEGER,
    related_wallet_id INTEGER REFERENCES wallets(id),
    project_id INTEGER REFERENCES projects(id),
    amount NUMERIC(20,2) NOT NULL,
    note_type TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reason TEXT,
    status TEXT CHECK (status IN ('draft','issued','applied','cancelled')) DEFAULT 'draft',
    applied_to_source_table TEXT,
    applied_to_source_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE debit_notes (
    id SERIAL PRIMARY KEY,
    note_number TEXT UNIQUE,
    issued_by_type TEXT CHECK (issued_by_type IN ('kg','vendor','customer')),
    issued_by_id INTEGER,
    related_wallet_id INTEGER REFERENCES wallets(id),
    project_id INTEGER REFERENCES projects(id),
    amount NUMERIC(20,2) NOT NULL,
    note_type TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reason TEXT,
    status TEXT CHECK (status IN ('draft','issued','applied','cancelled')) DEFAULT 'draft',
    applied_to_source_table TEXT,
    applied_to_source_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- APPROVALS & DOCUMENTS
-- ============================================================
CREATE TABLE approvals (
    id SERIAL PRIMARY KEY,
    related_entity TEXT,
    related_id INTEGER,
    requested_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approval_status TEXT CHECK (approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    related_entity TEXT,
    related_id INTEGER,
    document_type TEXT,
    file_url TEXT,
    file_metadata JSONB DEFAULT '{}'::JSONB,
    version INTEGER DEFAULT 1,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT,
    entity TEXT,
    entity_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    related_entity TEXT,
    related_id INTEGER,
    actor_id INTEGER REFERENCES users(id),
    action TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_estimations_project ON project_estimations(project_id);
CREATE INDEX idx_estimation_items_estimation ON estimation_items(estimation_id);
CREATE INDEX idx_purchase_requests_project ON purchase_requests(project_id);
CREATE INDEX idx_vendor_boqs_project ON vendor_boqs(project_id);
CREATE INDEX idx_vendor_boq_items_boq ON vendor_boq_items(boq_id);
CREATE INDEX idx_purchase_orders_project ON purchase_orders(project_id);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_project_ledger_project ON project_ledger(project_id);
CREATE INDEX idx_project_fin_events_project ON project_financial_events(project_id);
CREATE INDEX idx_fin_event_def_code ON financial_event_definitions(code);

-- ============================================================
-- SEED DATA - Financial Event Definitions
-- ============================================================
INSERT INTO financial_event_definitions (code, name, description, direction, default_percentage, default_trigger_phase, applicable_to) VALUES
('ADVANCE_10', 'Advance Payment (10%)', 'Initial 10% advance to kickstart project', 'inflow', 10, '2D', 'customer'),
('START_3D', '3D Design Payment (50%)', 'Payment to start 3D design including advance', 'inflow', 50, '3D', 'customer'),
('MISC_100', 'Misc Items Payment (100%)', 'Full payment for misc items before execution', 'inflow', 100, 'execution', 'customer'),
('FINAL_PAYMENT', 'Final Payment (100%)', 'Final settlement payment', 'inflow', 100, 'handover', 'customer'),
('VENDOR_ADVANCE', 'Vendor Advance Payment', 'Advance payment to vendor', 'outflow', 50, 'execution', 'vendor'),
('VENDOR_PROGRESS', 'Vendor Progress Payment', 'Progress payment to vendor', 'outflow', 80, 'execution', 'vendor'),
('VENDOR_FINAL', 'Vendor Final Payment', 'Final payment to vendor', 'outflow', 100, 'handover', 'vendor');
