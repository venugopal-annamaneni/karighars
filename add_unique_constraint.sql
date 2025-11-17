-- Add unique constraint to stable_item_id
ALTER TABLE estimation_items
  ADD CONSTRAINT uq_estimation_items_stable_id UNIQUE (stable_item_id);
