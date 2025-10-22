-- Remove category split columns from customer_payments
-- These are no longer needed as we track total amount only

ALTER TABLE customer_payments DROP COLUMN IF EXISTS woodwork_amount;
ALTER TABLE customer_payments DROP COLUMN IF EXISTS misc_amount;
ALTER TABLE customer_payments DROP COLUMN IF EXISTS pre_tax_amount;

-- Add comments to clarify
COMMENT ON COLUMN customer_payments.amount IS 'Total payment amount (no category split stored)';
COMMENT ON COLUMN customer_payments.payment_type IS 'Milestone code or ADHOC - used to filter shopping vs regular payments';
COMMENT ON COLUMN customer_payments.milestone_id IS 'Reference to biz_model_milestone - used to determine payment category';
