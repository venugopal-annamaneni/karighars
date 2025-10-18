# KG Interiors Finance Management System - Database Setup

## 📋 Quick Start

### For New Installation (Recommended)

```bash
# Create database
PGPASSWORD='your_password' psql -h your-host -U postgres -c "CREATE DATABASE kg_interiors_finance;"

# Import schema
PGPASSWORD='your_password' psql -h your-host -U postgres -d kg_interiors_finance -f schema.sql
```

That's it! ✅

---

## 📁 Files in This Directory

### Main Schema
- **`schema.sql`** - Complete database schema (use this for new installations)

### Migration Files (Optional - for existing databases)
- **`rename_phase_to_stage.sql`** - Renames projects.phase → projects.stage
- **`remove_expected_percentage.sql`** - Removes expected_percentage from customer_payments_in
- **`drop_stage_check_constraint.sql`** - Removes hardcoded stage CHECK constraint to allow dynamic stages from BizModels

---

## 🗂️ Database Structure (30 Tables)

### Authentication (4 tables)
- `users` - User accounts with roles
- `accounts` - OAuth provider accounts
- `sessions` - User sessions
- `verification_tokens` - Email verification

### Business Configuration (3 tables)
- `biz_models` - Business model definitions with versioning
- `biz_model_stages` - Project stages per business model
- `biz_model_milestones` - Payment milestones with cumulative percentages

### Customers & KYC (2 tables)
- `customers` - Customer info, KYC type, bank details
- `customer_kyc` - KYC document records

### Projects (3 tables)
- `projects` - Project master with stage tracking
- `project_collaborators` - Users assigned to projects
- `project_status_history` - Stage/status change log

### Estimations (2 tables)
- `project_estimations` - Versioned estimations with GST and overpayment tracking
- `estimation_items` - Line items (woodwork, misc_internal, misc_external)

### Financial Tracking (3 tables)
- `financial_event_definitions` - Event types (inflow/outflow)
- `project_financial_events` - Events linked to projects
- `project_ledger` - Complete financial ledger

### Customer Payments (1 table)
- `customer_payments_in` - All customer payments including credit notes

### Vendor Management (4 tables)
- `vendors` - Vendor information
- `vendor_boqs` - Bill of Quantities
- `vendor_boq_items` - BOQ line items
- `vendor_boq_status_history` - BOQ status changes

### Vendor Payments (1 table)
- `payments_out` - Payments to vendors

### Purchase Management (4 tables)
- `purchase_requests` - RFQs from projects
- `purchase_request_items` - Request line items
- `purchase_orders` - POs to vendors
- `purchase_order_status_history` - PO status tracking

### Documents & Logs (2 tables)
- `documents` - Centralized document storage
- `activity_logs` - Project activity tracking

---

## 🔑 Key Features

### 1. Overpayment Workflow
When estimation is revised to lower value:
- Creates estimation with `overpayment_status='pending_approval'`
- Admin approves → Creates credit note in `customer_payments_in`
- Finance uploads document → Credit note approved
- Ledger reflects adjustment automatically

### 2. Milestone-Based Payments
- BizModel defines cumulative percentages per category
- Woodwork and Misc tracked separately
- Ad-hoc (ADHOC) payments supported
- GST calculated at estimation level

### 3. BizModel Versioning
- Automatic version increment (V1, V2, V3...)
- Draft vs Published status
- Projects must use published models

### 4. Stage-Based Workflow
- Projects have `stage` (from biz_model_stages)
- Payments filtered by current stage
- Stage transitions tracked in history

### 5. Document Management
- Payment receipts
- Project invoices
- Credit notes
- KYC documents

---

## 🔧 Environment Setup

### Required Environment Variables

```env
# PostgreSQL
DATABASE_URL=postgresql://username:password@host:5432/kg_interiors_finance?sslmode=require

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Application
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

---

## 🚀 Migration from Old Installation

If you have an existing database with old schema:

```bash
# Backup first!
pg_dump -h your-host -U postgres kg_interiors_finance > backup.sql

# Apply migrations
PGPASSWORD='your_password' psql -h your-host -U postgres -d kg_interiors_finance -f rename_phase_to_stage.sql
PGPASSWORD='your_password' psql -h your-host -U postgres -d kg_interiors_finance -f remove_expected_percentage.sql
```

---

## 🧪 Verify Installation

```sql
-- Check table count (should be 30)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check key tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users', 'projects', 'project_estimations', 
    'customer_payments_in', 'biz_models'
  )
ORDER BY table_name;
```

---

## 📊 Data Model Key Relationships

```
biz_models
  ├─ biz_model_stages (stages per model)
  └─ biz_model_milestones (payment milestones)

projects
  ├─ customer_id → customers
  ├─ biz_model_id → biz_models
  ├─ stage (current stage_code)
  └─ project_estimations (versioned)
       └─ estimation_items

customer_payments_in
  ├─ project_id → projects
  ├─ estimation_id → project_estimations
  ├─ related_estimation_id (for credit notes)
  └─ Creates → project_ledger entries
```

---

## 🔐 Default Roles

- `admin` - Full access
- `finance` - Payment approval, document upload
- `sales` - Project creation, customer management
- `estimator` - Estimation creation/editing
- `designer` - Project collaboration
- `project_manager` - Project oversight

---

## 📝 Important Notes

1. **First User**: First user to sign in with Google OAuth becomes admin (configure in auth)
2. **BizModels**: Create at least one published BizModel before creating projects
3. **Stages**: BizModel must have stages defined for project workflow
4. **Milestones**: Define cumulative percentages for payment tracking
5. **Credit Notes**: Always appear as negative amounts in customer_payments_in

---

## 🆘 Troubleshooting

### Connection Issues
- Check `DATABASE_URL` format
- Verify network access to database host
- Ensure SSL settings match (`sslmode=require` for cloud databases)

### Missing Tables
- Re-run `schema.sql`
- Check for error messages during import

### Authentication Issues
- Verify Google OAuth credentials
- Check `NEXTAUTH_URL` matches your domain
- Ensure `NEXTAUTH_SECRET` is set

---

## 📚 Additional Documentation

- `SCHEMA_CLEANUP_SUMMARY.md` - Detailed schema documentation
- `QUICK_START_GUIDE.md` - General setup guide
- `RDS_SETUP_INSTRUCTIONS.md` - AWS RDS specific setup

---

**Version:** 1.0  
**Last Updated:** June 2025  
**PostgreSQL Version:** 15+
