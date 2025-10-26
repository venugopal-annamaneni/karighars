-- Migration: Add Room/Section concept with flexible unit-based quantity
-- Adds: room_name, unit, width, height columns to estimation_items

BEGIN;

-- Add new columns to estimation_items table
ALTER TABLE estimation_items
  ADD COLUMN IF NOT EXISTS room_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'sqft',
  ADD COLUMN IF NOT EXISTS width DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS height DECIMAL(10,2);

-- Add check constraint for unit
ALTER TABLE estimation_items
  DROP CONSTRAINT IF EXISTS estimation_items_unit_check;

ALTER TABLE estimation_items
  ADD CONSTRAINT estimation_items_unit_check 
  CHECK (unit IN ('sqft', 'no', 'lumpsum'));

-- Make room_name NOT NULL after adding column (for new rows)
-- Note: Existing rows (if any) will have NULL, but we truncated data already
ALTER TABLE estimation_items
  ALTER COLUMN room_name SET NOT NULL;

ALTER TABLE estimation_items
  ALTER COLUMN unit SET NOT NULL;

COMMIT;

-- Verify schema changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'estimation_items'
  AND column_name IN ('room_name', 'unit', 'width', 'height', 'quantity')
ORDER BY ordinal_position;

COMMENT ON COLUMN estimation_items.room_name IS 'Room or section name (e.g., Living Room, Kitchen) - mandatory';
COMMENT ON COLUMN estimation_items.unit IS 'Unit of measurement: sqft (area), no (count), lumpsum (fixed)';
COMMENT ON COLUMN estimation_items.width IS 'Width dimension - used only when unit = sqft';
COMMENT ON COLUMN estimation_items.height IS 'Height dimension - used only when unit = sqft';
COMMENT ON COLUMN estimation_items.quantity IS 'Quantity - auto-calculated (width x height) for sqft, manual input for no/lumpsum';
