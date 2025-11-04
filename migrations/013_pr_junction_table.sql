-- Migration 013: Restructure Purchase Request Schema with Junction Table
-- Date: 2025-01-30

BEGIN;

-- Step 1: Create new junction table
CREATE TABLE purchase_request_estimation_links (
    id SERIAL PRIMARY KEY,
    estimation_item_id INTEGER NOT NULL REFERENCES estimation_items(id) ON DELETE CASCADE,
    purchase_request_item_id INTEGER NOT NULL REFERENCES purchase_request_items(id) ON DELETE CASCADE,
    linked_qty NUMERIC(10,2) NOT NULL,
    unit_purchase_request_item_weightage NUMERIC(5,4) NOT NULL CHECK (unit_purchase_request_item_weightage > 0 AND unit_purchase_request_item_weightage <= 1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT check_linked_qty_positive CHECK (linked_qty > 0)
);

CREATE INDEX idx_prel_estimation ON purchase_request_estimation_links(estimation_item_id);
CREATE INDEX idx_prel_pr_item ON purchase_request_estimation_links(purchase_request_item_id);

COMMENT ON TABLE purchase_request_estimation_links IS 'Junction table linking PR items to estimation items with weightage';
COMMENT ON COLUMN purchase_request_estimation_links.linked_qty IS 'Quantity of PR item linked to this estimation item';
COMMENT ON COLUMN purchase_request_estimation_links.unit_purchase_request_item_weightage IS 'Weightage per unit: 1.0 = full item, 0.5 = half, etc. Used to calculate fulfillment.';

-- Step 2: Add estimation_id to purchase_requests
ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS estimation_id INTEGER REFERENCES project_estimations(id);

-- Populate estimation_id from project (get active estimation)
UPDATE purchase_requests pr
SET estimation_id = (
    SELECT pe.id 
    FROM project_estimations pe
    WHERE pe.project_id = pr.project_id 
    AND pe.is_active = true
    LIMIT 1
)
WHERE estimation_id IS NULL;

-- Step 3: Restructure purchase_request_items
ALTER TABLE purchase_request_items
RENAME COLUMN item_name TO purchase_request_item_name;

ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS unit VARCHAR(20),
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';

-- Remove old columns
ALTER TABLE purchase_request_items
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS room_name,
DROP COLUMN IF EXISTS notes;

-- Remove old constraint
ALTER TABLE purchase_request_items
DROP CONSTRAINT IF EXISTS unique_pr_estimation_item;

-- Step 4: Update status values
UPDATE purchase_requests 
SET status = 'confirmed' 
WHERE status IN ('Draft', 'Submitted', 'Approved');

UPDATE purchase_requests 
SET status = 'cancelled' 
WHERE status IN ('Rejected', 'Cancelled');

-- Step 5: Add notes to purchase_requests
ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Step 6: Comments
COMMENT ON COLUMN purchase_request_items.purchase_request_item_name IS 'PR item name - can differ from estimation item (for components)';
COMMENT ON COLUMN purchase_request_items.active IS 'Soft delete flag';
COMMENT ON COLUMN purchase_request_items.status IS 'confirmed or cancelled';
COMMENT ON COLUMN purchase_requests.estimation_id IS 'Links to the estimation this PR is for';

COMMIT;
