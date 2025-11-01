-- Migration: Add Purchase Request tables
-- Date: 2025-01-30

BEGIN;

-- Create purchase_requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
    id SERIAL PRIMARY KEY,
    pr_number VARCHAR(50) UNIQUE NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'Draft',
    
    -- User tracking
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    
    -- Dates
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    
    -- Financial
    total_amount NUMERIC(20,2) DEFAULT 0,
    gst_amount NUMERIC(12,2) DEFAULT 0,
    final_amount NUMERIC(20,2) DEFAULT 0,
    
    -- Additional info
    remarks TEXT,
    payment_terms TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create purchase_request_items table
CREATE TABLE IF NOT EXISTS purchase_request_items (
    id SERIAL PRIMARY KEY,
    purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    estimation_item_id INTEGER NOT NULL UNIQUE REFERENCES estimation_items(id) ON DELETE CASCADE,
    
    -- Item details snapshot (from estimation_item)
    category VARCHAR(100),
    room_name VARCHAR(255),
    item_name TEXT,
    quantity NUMERIC(10,2),
    unit VARCHAR(20),
    unit_price NUMERIC(12,2),
    
    -- Pricing
    quoted_price NUMERIC(12,2),
    final_price NUMERIC(12,2),
    
    -- Totals
    subtotal NUMERIC(20,2),
    gst_amount NUMERIC(12,2),
    item_total NUMERIC(20,2),
    
    -- Delivery tracking
    received_quantity NUMERIC(10,2) DEFAULT 0,
    pending_quantity NUMERIC(10,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pr_project ON purchase_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_vendor ON purchase_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pr_created_by ON purchase_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_pri_pr ON purchase_request_items(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_pri_estimation ON purchase_request_items(estimation_item_id);

-- Add comments
COMMENT ON TABLE purchase_requests IS 'Purchase requests created from estimation items';
COMMENT ON TABLE purchase_request_items IS 'Line items in purchase requests with 1-1 mapping to estimation items';
COMMENT ON COLUMN purchase_requests.pr_number IS 'Auto-generated PR number format: PR-{project_id}-{sequence}';
COMMENT ON COLUMN purchase_requests.status IS 'PR status: Draft, Submitted, Approved, Rejected, Cancelled';
COMMENT ON COLUMN purchase_request_items.estimation_item_id IS 'Unique reference to estimation item (1-1 mapping)';

COMMIT;
