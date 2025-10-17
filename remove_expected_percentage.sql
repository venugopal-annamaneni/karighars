-- Migration: Remove expected_percentage from customer_payments_in
-- Date: June 2025
-- Reason: Field is not meaningful for cumulative milestone tracking

ALTER TABLE customer_payments_in DROP COLUMN IF EXISTS expected_percentage;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_payments_in' AND column_name = 'expected_percentage';
-- Should return 0 rows
