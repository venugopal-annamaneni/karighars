# Database Schema Cleanup Summary

## Overview
This document summarizes the cleanup performed on the KG Interiors Finance Management System database schema. The goal was to create a clean, production-ready schema file that includes all currently implemented features and removes unused tables/fields.

## Clean Schema File
**File:** `kg_interiors_clean_schema.sql`

## Tables Retained (Core System)

### Authentication & User Management (5 tables)
- ✅ **users** - User accounts with roles (admin, finance, sales, etc.)
- ✅ **accounts** - OAuth accounts (Google OAuth)
- ✅ **sessions** - User sessions for NextAuth.js
- ✅ **verification_tokens** - Email verification tokens

### Business Models (3 tables)
- ✅ **biz_models** - Business model definitions with versioning
- ✅ **biz_model_stages** - Project stages for each business model
- ✅ **biz_model_milestones** - Payment milestones with cumulative woodwork/misc percentages

### Customers & KYC (2 tables)
- ✅ **customers** - Customer information with KYC type, business type, bank details
- ✅ **customer_kyc** - Customer KYC documents (pending UI implementation)

### Vendors (1 table)
- ✅ **vendors** - Vendor information

### Projects (3 tables)
- ✅ **projects** - Project master with customer, BizModel, invoice fields, credit note fields
- ✅ **project_collaborators** - Users assigned to projects
- ✅ **project_status_history** - Project status change tracking

### Estimations (2 tables)
- ✅ **project_estimations** - Project estimations with GST, overpayment handling
- ✅ **estimation_items** - Line items for estimations (woodwork, misc_internal, misc_external)

### Financial Events & Ledger (3 tables)
- ✅ **financial_event_definitions** - Definition of financial events
- ✅ **project_financial_events** - Financial events for projects
- ✅ **project_ledger** - Project-level ledger entries

### Customer Payments (1 table)
- ✅ **customer_payments_in** - Customer payments with milestone tracking, GST breakdown, status, receipts

### Vendor BOQs & Payments (4 tables)
- ✅ **vendor_boqs** - Vendor Bill of Quantities
- ✅ **vendor_boq_items** - Items in vendor BOQs
- ✅ **vendor_boq_status_history** - BOQ status change history
- ✅ **payments_out** - Payments to vendors

### Purchase Management (4 tables)
- ✅ **purchase_requests** - Purchase requests from projects
- ✅ **purchase_request_items** - Items in purchase requests
- ✅ **purchase_orders** - Purchase orders to vendors
- ✅ **purchase_order_status_history** - PO status change history

### Documents (1 table)
- ✅ **documents** - Centralized document storage for receipts, invoices, credit notes (pending UI)

### Activity Logs (1 table)
- ✅ **activity_logs** - Activity tracking for projects

**Total: 30 tables retained**

---

## Tables Removed (Unused/Redundant)

### Wallet System (3 tables removed)
- ❌ **wallets** - Wallet-based accounting not actively used
- ❌ **wallet_transactions** - Wallet transactions not needed
- ❌ **trg_wallet_balance_update_fn()** - Trigger function for wallet updates

**Reason:** The wallet system was part of an initial design but is not being used in the current implementation. Financial tracking is done through `project_ledger`, `customer_payments_in`, and `payments_out`.

### Credit/Debit Notes Tables (2 tables removed)
- ❌ **credit_notes** - Generic credit notes table
- ❌ **debit_notes** - Generic debit notes table

**Reason:** Credit notes for overpayments are now handled directly in `customer_payments_in` table with `payment_type = 'credit_note_reversal'`. This is simpler and more integrated with the payment workflow.

### Generic Approvals (1 table removed)
- ❌ **approvals** - Generic approval tracking

**Reason:** Approvals are now handled at the entity level (e.g., `project_estimations.overpayment_status`, `customer_payments_in.status`). This provides better context and eliminates the need for a generic approval table.

### Audit Logs (1 table removed)
- ❌ **audit_logs** - Detailed audit trail with old/new data

**Reason:** While audit logging is a good practice, it was not being actively used. `activity_logs` table provides sufficient tracking for current needs. Can be re-added in the future if detailed audit requirements emerge.

### Vendor Rate Cards (1 table removed)
- ❌ **vendor_rate_cards** - Vendor pricing catalog

**Reason:** Not actively used in recent development. Vendor rates are being managed at the BOQ item level.

**Total: 8 tables removed**

---

## Key Schema Features Retained

### 1. KYC & GST Support
- `customers.kyc_type` - aadhar, pan, blank_cheque, none
- `customers.business_type` - B2B, B2C
- `customers.bank_details` - JSONB for flexible bank info
- `customer_kyc` table for document storage

### 2. BizModel Versioning
- `biz_models.status` - draft/published
- `biz_models.version` - V1, V2, etc.
- Draft models cannot be used in projects

### 3. Milestone-based Payments
- `biz_model_milestones.woodwork_percentage` - Cumulative tracking
- `biz_model_milestones.misc_percentage` - Cumulative tracking
- `customer_payments_in.payment_type` - Milestone code or MISC

### 4. GST at Estimation Level
- `project_estimations.gst_percentage` - GST rate (default 18%)
- `project_estimations.gst_amount` - Calculated GST
- `customer_payments_in.gst_amount` - GST breakdown per payment
- `customer_payments_in.pre_tax_amount` - Amount before GST

### 5. Overpayment Handling
- `project_estimations.has_overpayment` - Detection flag
- `project_estimations.overpayment_amount` - Amount of excess
- `project_estimations.overpayment_status` - pending_approval, approved, rejected
- `project_estimations.overpayment_approved_by` - Admin who approved
- `project_estimations.overpayment_credit_note_url` - Document link
- Reversal entries created in `customer_payments_in` with negative amount

### 6. Document Management
- `documents` table for centralized storage
- `customer_payments_in.receipt_url` - Payment receipts
- `projects.invoice_url` - Project invoices
- `projects.credit_note_url` - Credit note documents

### 7. Payment Status Workflow
- `customer_payments_in.status` - pending, approved, rejected
- Payments become active only after receipt upload and approval

---

## Database Setup Instructions

### For Local Development:

1. **Install PostgreSQL 15+**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-15 postgresql-contrib
   
   # macOS (Homebrew)
   brew install postgresql@15
   ```

2. **Create Database**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE kg_interiors_finance;
   CREATE USER kg_user WITH ENCRYPTED PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE kg_interiors_finance TO kg_user;
   \q
   ```

3. **Run Schema**
   ```bash
   psql -U kg_user -d kg_interiors_finance -f kg_interiors_clean_schema.sql
   ```

4. **Update .env File**
   ```env
   POSTGRES_URL=postgresql://kg_user:your_secure_password@localhost:5432/kg_interiors_finance
   ```

### For Production/Cloud:

1. **Create PostgreSQL Instance**
   - AWS RDS, Google Cloud SQL, or Azure Database for PostgreSQL
   - Ensure PostgreSQL version 15+

2. **Configure Networking**
   - Allow connections from your application servers
   - Use SSL/TLS for secure connections

3. **Run Schema**
   ```bash
   psql -h your-db-host -U your-user -d kg_interiors_finance -f kg_interiors_clean_schema.sql
   ```

4. **Update Environment Variables**
   ```env
   POSTGRES_URL=postgresql://user:password@host:5432/kg_interiors_finance?sslmode=require
   ```

---

## Pending Features (Schema Ready)

The following features have schema support but UI implementation is pending:

1. **Customer Detail/Edit Page** (`/customers/[id]/page.js`)
   - Display and edit KYC information
   - Show/edit bank details
   - Upload KYC documents

2. **Finance Invoice Upload** (Project detail page)
   - Upload project invoice
   - Set revenue realized amount
   - Track invoice status

3. **Documents Tab** (Project detail page)
   - Display all documents for a project
   - Show payment receipts from `customer_payments_in.receipt_url`
   - Show project invoice from `projects.invoice_url`
   - Show credit notes from `customer_payments_in.credit_note_url`

4. **Overpayment Approval UI** (PARTIALLY DONE)
   - Banner showing pending approval status ✅
   - Admin approval button ✅
   - Reversal entry creation ✅
   - UI display of reversal entries (pending verification)

---

## Migration Notes

If you have existing data in the old schema and want to migrate:

1. **Backup your current database**
   ```bash
   pg_dump -U username -d kg_interiors_finance > backup_$(date +%Y%m%d).sql
   ```

2. **The clean schema should match your current structure** (with removed unused tables)
   - No data migration needed for retained tables
   - Unused tables (wallets, credit_notes, etc.) can be dropped manually if present

3. **Verify all data is accessible after applying clean schema**
   ```sql
   -- Check record counts
   SELECT 'users' as table_name, COUNT(*) FROM users
   UNION ALL SELECT 'projects', COUNT(*) FROM projects
   UNION ALL SELECT 'customers', COUNT(*) FROM customers;
   ```

---

## Schema Maintenance

### Adding New Features
1. Add new tables/columns to `kg_interiors_clean_schema.sql`
2. Create migration SQL file (e.g., `alter_feature_name.sql`)
3. Update this documentation

### Modifying Existing Tables
1. Create an ALTER script
2. Test in development first
3. Document changes here

### Indexes
- All common query patterns have indexes defined
- Add new indexes if you notice slow queries

---

## File References

- **Clean Schema:** `/app/kg_interiors_clean_schema.sql`
- **Main API:** `/app/app/api/[[...path]]/route.js`
- **Database Connection:** `/app/lib/db.js`

---

## Support

For questions or issues with the schema:
1. Check this document first
2. Review the comments in `kg_interiors_clean_schema.sql`
3. Examine the API route file to see how tables are used

---

**Generated:** June 2025  
**Schema Version:** v1.0 (Clean)  
**PostgreSQL Version:** 15+  
**Total Tables:** 30 (core tables only)
