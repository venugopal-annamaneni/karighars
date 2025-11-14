-- Migration 020: Remove deleted_at and deleted_by columns from PR items
-- These columns are unnecessary with the versioning architecture
-- Deletions are implicit: if an item is not in the current table, it was deleted
-- Full history is preserved in the history tables

-- Remove from current table
ALTER TABLE purchase_request_items
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;

-- Remove from history table
ALTER TABLE purchase_request_items_history
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;

-- Add comment explaining the deletion model
COMMENT ON TABLE purchase_request_items IS 
  'Current version of PR items. Deletions are implicit - if an item is not here, it was deleted. Full history in purchase_request_items_history.';

COMMENT ON TABLE purchase_request_items_history IS 
  'Complete audit trail of all PR item versions. Compare versions to identify deleted items.';
