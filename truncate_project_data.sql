-- Truncate project-related data while keeping biz_models and customers
-- This script preserves: biz_models, customers, users

BEGIN;

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Truncate activity logs first (no dependencies)
TRUNCATE TABLE activity_logs CASCADE;

-- Truncate project invoices and related data
TRUNCATE TABLE project_invoices CASCADE;

-- Truncate customer payments
TRUNCATE TABLE customer_payments CASCADE;

-- Truncate estimation items and estimations
TRUNCATE TABLE estimation_items CASCADE;
TRUNCATE TABLE estimations CASCADE;

-- Truncate documents
TRUNCATE TABLE documents CASCADE;

-- Finally truncate projects
TRUNCATE TABLE projects CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

COMMIT;

-- Verify truncation
SELECT 'projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'estimations', COUNT(*) FROM estimations
UNION ALL
SELECT 'estimation_items', COUNT(*) FROM estimation_items
UNION ALL
SELECT 'customer_payments', COUNT(*) FROM customer_payments
UNION ALL
SELECT 'project_invoices', COUNT(*) FROM project_invoices
UNION ALL
SELECT 'biz_models (preserved)', COUNT(*) FROM biz_models
UNION ALL
SELECT 'customers (preserved)', COUNT(*) FROM customers;
