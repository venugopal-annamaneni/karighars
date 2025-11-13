-- Migration 019: Add full versioning support to purchase request items
-- Date: 2025-01-30
-- Purpose: Enable item-level lifecycle and full versioning with stable IDs

BEGIN;

-- 1. Add stable_item_id and version to purchase_request_items
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS stable_item_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(30) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS updated_by INTEGER,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. Create history table (identical structure to main table)
CREATE TABLE IF NOT EXISTS purchase_request_items_history (
  id INTEGER NOT NULL,
  stable_item_id UUID NOT NULL,
  purchase_request_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  
  -- Item details
  purchase_request_item_name TEXT,
  category VARCHAR(100),
  room_name VARCHAR(255),
  quantity NUMERIC(10,2),
  unit VARCHAR(20),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  
  -- Pricing
  unit_price NUMERIC(12,2),
  subtotal NUMERIC(20,2),
  gst_percentage NUMERIC(5,2),
  gst_amount NUMERIC(12,2),
  amount_before_gst NUMERIC(20,2),
  item_total NUMERIC(20,2),
  
  -- Lifecycle
  lifecycle_status VARCHAR(30),
  
  -- Flags
  is_direct_purchase BOOLEAN,
  active BOOLEAN,
  status VARCHAR(20),
  
  -- Original timestamps
  created_at TIMESTAMP,
  created_by INTEGER,
  updated_at TIMESTAMP,
  updated_by INTEGER,
  deleted_at TIMESTAMP,
  deleted_by INTEGER,
  
  -- Archive metadata
  archived_at TIMESTAMP DEFAULT NOW(),
  archived_by INTEGER,
  
  PRIMARY KEY (id, version)
);

-- 3. Create PR versions tracking table
CREATE TABLE IF NOT EXISTS purchase_request_versions (
  id SERIAL PRIMARY KEY,
  purchase_request_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  
  -- Change metadata
  change_type VARCHAR(50),
  change_summary TEXT,
  items_affected UUID[], -- Array of stable_item_ids
  
  -- Version snapshot data
  total_items INTEGER,
  version_value NUMERIC(20,2),
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER,
  
  CONSTRAINT unique_pr_version UNIQUE (purchase_request_id, version)
);

-- 4. Update estimation links to use stable_item_id
ALTER TABLE purchase_request_estimation_links
ADD COLUMN IF NOT EXISTS stable_item_id UUID,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Populate stable_item_id for existing links
UPDATE purchase_request_estimation_links prel
SET stable_item_id = pri.stable_item_id
FROM purchase_request_items pri
WHERE prel.purchase_request_item_id = pri.id;

-- 5. Create estimation links history table
CREATE TABLE IF NOT EXISTS purchase_request_estimation_links_history (
  id INTEGER NOT NULL,
  stable_item_id UUID NOT NULL,
  version INTEGER NOT NULL,
  
  estimation_item_id INTEGER,
  purchase_request_item_id INTEGER,
  linked_qty NUMERIC(10,2),
  unit_purchase_request_item_weightage NUMERIC(5,4),
  notes TEXT,
  
  created_at TIMESTAMP,
  archived_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (id, version)
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pri_stable_id ON purchase_request_items(stable_item_id);
CREATE INDEX IF NOT EXISTS idx_pri_pr_version ON purchase_request_items(purchase_request_id, version);
CREATE INDEX IF NOT EXISTS idx_pri_lifecycle ON purchase_request_items(lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_prih_stable_id ON purchase_request_items_history(stable_item_id);
CREATE INDEX IF NOT EXISTS idx_prih_pr_version ON purchase_request_items_history(purchase_request_id, version);

CREATE INDEX IF NOT EXISTS idx_prel_stable ON purchase_request_estimation_links(stable_item_id, version);

CREATE INDEX IF NOT EXISTS idx_prv_pr ON purchase_request_versions(purchase_request_id);

-- 7. Add comments
COMMENT ON COLUMN purchase_request_items.stable_item_id 
IS 'Permanent UUID that stays same across all versions of this item';

COMMENT ON COLUMN purchase_request_items.version 
IS 'Version number - increments when ANY item in the PR is edited';

COMMENT ON COLUMN purchase_request_items.lifecycle_status 
IS 'Item lifecycle: pending, sent_to_vendor, confirmed, in_production, delivered, invoiced, paid';

COMMENT ON TABLE purchase_request_items_history 
IS 'Historical versions of all PR items - complete snapshots';

COMMENT ON TABLE purchase_request_versions 
IS 'Metadata about each version change';

COMMIT;
