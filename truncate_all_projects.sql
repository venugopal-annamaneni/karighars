-- Truncate all projects and related data
-- WARNING: This will delete ALL project data and cannot be undone!

-- Disable triggers temporarily for faster truncation
SET session_replication_role = 'replica';

-- Truncate all project-related tables in order
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE payments_out CASCADE;
TRUNCATE TABLE purchase_order_status_history CASCADE;
TRUNCATE TABLE purchase_orders CASCADE;
TRUNCATE TABLE purchase_request_items CASCADE;
TRUNCATE TABLE purchase_requests CASCADE;
TRUNCATE TABLE vendor_boq_status_history CASCADE;
TRUNCATE TABLE vendor_boq_items CASCADE;
TRUNCATE TABLE vendor_boqs CASCADE;
TRUNCATE TABLE customer_payments_in CASCADE;
TRUNCATE TABLE project_ledger CASCADE;
TRUNCATE TABLE project_financial_events CASCADE;
TRUNCATE TABLE estimation_items CASCADE;
TRUNCATE TABLE project_estimations CASCADE;
TRUNCATE TABLE project_status_history CASCADE;
TRUNCATE TABLE project_collaborators CASCADE;
TRUNCATE TABLE projects CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Reset sequences to start from 1 again
ALTER SEQUENCE projects_id_seq RESTART WITH 1;
ALTER SEQUENCE project_estimations_id_seq RESTART WITH 1;
ALTER SEQUENCE estimation_items_id_seq RESTART WITH 1;
ALTER SEQUENCE customer_payments_in_id_seq RESTART WITH 1;
ALTER SEQUENCE project_ledger_id_seq RESTART WITH 1;
ALTER SEQUENCE project_financial_events_id_seq RESTART WITH 1;
ALTER SEQUENCE vendor_boqs_id_seq RESTART WITH 1;
ALTER SEQUENCE vendor_boq_items_id_seq RESTART WITH 1;
ALTER SEQUENCE purchase_requests_id_seq RESTART WITH 1;
ALTER SEQUENCE purchase_request_items_id_seq RESTART WITH 1;
ALTER SEQUENCE purchase_orders_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_out_id_seq RESTART WITH 1;
ALTER SEQUENCE documents_id_seq RESTART WITH 1;
ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1;

SELECT 'All project data truncated successfully' AS result;
