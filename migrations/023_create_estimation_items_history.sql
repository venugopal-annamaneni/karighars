-- Migration 023: Create estimation_items_history table
-- Mirrors purchase_request_items_history pattern for consistent versioning

CREATE TABLE estimation_items_history (
    -- Identifiers & Relations
    id INTEGER NOT NULL,
    stable_item_id UUID NOT NULL,
    estimation_id INTEGER NOT NULL,
    
    -- Item Details
    category TEXT,
    room_name VARCHAR NOT NULL,
    vendor_type VARCHAR,
    item_name TEXT NOT NULL,
    
    -- Dimensions & Quantity
    unit VARCHAR DEFAULT 'sqft',
    width NUMERIC,
    height NUMERIC,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    
    -- Pricing
    subtotal NUMERIC NOT NULL,
    karighar_charges_percentage NUMERIC DEFAULT 10,
    karighar_charges_amount NUMERIC DEFAULT 0,
    item_discount_percentage NUMERIC DEFAULT 0,
    item_discount_amount NUMERIC DEFAULT 0,
    discount_kg_charges_percentage NUMERIC DEFAULT 0,
    discount_kg_charges_amount NUMERIC DEFAULT 0,
    gst_percentage NUMERIC NOT NULL,
    gst_amount NUMERIC DEFAULT 0,
    amount_before_gst NUMERIC DEFAULT 0,
    item_total NUMERIC DEFAULT 0,
    
    -- Status
    status VARCHAR DEFAULT 'queued',
    
    -- Original Audit Fields
    created_at TIMESTAMPTZ,
    created_by INTEGER,
    updated_at TIMESTAMPTZ,
    updated_by INTEGER,
    
    -- History-Specific Fields
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by INTEGER,
    
    -- Primary key: composite to allow same id across multiple versions
    PRIMARY KEY (id, archived_at)
);

-- Indexes for querying history
CREATE INDEX idx_estimation_items_history_stable_id ON estimation_items_history(stable_item_id);
CREATE INDEX idx_estimation_items_history_estimation_id ON estimation_items_history(estimation_id);
CREATE INDEX idx_estimation_items_history_archived_at ON estimation_items_history(archived_at);

-- Add comments
COMMENT ON TABLE estimation_items_history IS 
  'Complete audit trail of all estimation item versions. Items are moved here when a new estimation version is created. Mirrors purchase_request_items_history pattern.';

COMMENT ON COLUMN estimation_items_history.archived_at IS 
  'Timestamp when this version was archived (moved from estimation_items to history)';

COMMENT ON COLUMN estimation_items_history.archived_by IS 
  'User ID who created the new version that caused this item to be archived';
