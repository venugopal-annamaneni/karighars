-- Migration 015: Support Direct Purchase Items (not linked to estimation)
-- Date: 2025-01-30

BEGIN;

-- Add columns to support direct purchase items
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_direct_purchase BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_pri_direct ON purchase_request_items(is_direct_purchase);

-- Add comments
COMMENT ON COLUMN purchase_request_items.category 
IS 'Category for direct purchase items (null for estimation-linked items, populated via junction)';

COMMENT ON COLUMN purchase_request_items.room_name 
IS 'Room name for direct purchase items (optional)';

COMMENT ON COLUMN purchase_request_items.is_direct_purchase 
IS 'True if item is ad-hoc purchase not linked to any estimation item';

-- Make estimation_id nullable in purchase_requests for direct PRs
ALTER TABLE purchase_requests
ALTER COLUMN estimation_id DROP NOT NULL;

COMMENT ON COLUMN purchase_requests.estimation_id 
IS 'Links to estimation - NULL for direct/ad-hoc purchase requests';

COMMIT;
