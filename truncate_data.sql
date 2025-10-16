-- ============================================================
-- Truncate All Transactional Data (Keep BizModels & Structure)
-- ============================================================

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Truncate all transactional tables
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE wallet_transactions CASCADE;
TRUNCATE TABLE wallets CASCADE;
TRUNCATE TABLE credit_notes CASCADE;
TRUNCATE TABLE debit_notes CASCADE;
TRUNCATE TABLE project_ledger CASCADE;
TRUNCATE TABLE payments_out CASCADE;
TRUNCATE TABLE customer_payments_in CASCADE;
TRUNCATE TABLE project_financial_events CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE approvals CASCADE;
TRUNCATE TABLE purchase_order_status_history CASCADE;
TRUNCATE TABLE purchase_orders CASCADE;
TRUNCATE TABLE vendor_boq_status_history CASCADE;
TRUNCATE TABLE vendor_boq_items CASCADE;
TRUNCATE TABLE vendor_boqs CASCADE;
TRUNCATE TABLE purchase_request_items CASCADE;
TRUNCATE TABLE purchase_requests CASCADE;
TRUNCATE TABLE estimation_items CASCADE;
TRUNCATE TABLE project_estimations CASCADE;
TRUNCATE TABLE project_status_history CASCADE;
TRUNCATE TABLE project_collaborators CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE customer_kyc CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE vendor_rate_cards CASCADE;
TRUNCATE TABLE vendors CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Keep these tables (configuration & auth):
-- - biz_models (keep configuration)
-- - biz_model_stages (keep configuration)
-- - biz_model_milestones (keep configuration)
-- - financial_event_definitions (keep configuration)
-- - users (keep user accounts)
-- - accounts (keep OAuth data)
-- - sessions (keep active sessions)
-- - verification_tokens (keep auth tokens)

-- Reset sequences for clean IDs
ALTER SEQUENCE customers_id_seq RESTART WITH 1;
ALTER SEQUENCE projects_id_seq RESTART WITH 1;
ALTER SEQUENCE project_estimations_id_seq RESTART WITH 1;
ALTER SEQUENCE estimation_items_id_seq RESTART WITH 1;
ALTER SEQUENCE vendors_id_seq RESTART WITH 1;
ALTER SEQUENCE vendor_boqs_id_seq RESTART WITH 1;
ALTER SEQUENCE purchase_orders_id_seq RESTART WITH 1;
ALTER SEQUENCE customer_payments_in_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_out_id_seq RESTART WITH 1;
ALTER SEQUENCE project_ledger_id_seq RESTART WITH 1;
ALTER SEQUENCE wallets_id_seq RESTART WITH 1;
ALTER SEQUENCE wallet_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE documents_id_seq RESTART WITH 1;
ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1;

SELECT 'Database truncated successfully! All transactional data cleared.' as status;
SELECT 'BizModels, Users, and Configuration preserved.' as note;
