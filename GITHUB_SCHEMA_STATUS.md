# GitHub Schema Status & Update Guide

## Current Status: ❌ OUT OF DATE

The GitHub repository does **NOT** have the most up-to-date PostgreSQL schema. Several schema changes were made during development that are not reflected in the repository.

---

## Schema Files in Repository

### Existing Files:
1. `init_schema.sql` - Base schema (original)
2. `biz_model_schema.sql` - BizModel system
3. `alter_kyc_gst_schema.sql` - KYC & GST additions
4. `gst_refactor_schema.sql` - GST moved to estimations
5. `complete_schema_fix.sql` - Various fixes
6. `truncate_data.sql` - Data cleanup script
7. `verify_complete_schema.sql` - Verification script

### Missing Changes:
❌ `woodwork_percentage` and `misc_percentage` in `biz_model_milestones`
❌ Removed `default_percentage` from `biz_model_milestones`
❌ `status` column in `biz_models` (draft/published)
❌ Overpayment tracking fields in `projects` and `project_estimations`
❌ `credit_note_url` in `customer_payments_in`
❌ Updated payment_type constraint (removed restrictive CHECK)

---

## Latest Schema Changes (Not in GitHub)

### 1. biz_model_milestones
```sql
-- Added
ALTER TABLE biz_model_milestones
ADD COLUMN woodwork_percentage NUMERIC(9,4) DEFAULT 0,
ADD COLUMN misc_percentage NUMERIC(9,4) DEFAULT 0;

-- Removed
ALTER TABLE biz_model_milestones DROP COLUMN default_percentage;
```

### 2. biz_models
```sql
-- Added
ALTER TABLE biz_models
ADD COLUMN status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft';

CREATE INDEX idx_biz_models_status ON biz_models(status);
```

### 3. projects (Overpayment Handling)
```sql
-- Added
ALTER TABLE projects 
ADD COLUMN customer_credit NUMERIC(20,2) DEFAULT 0.00,
ADD COLUMN credit_note_url TEXT,
ADD COLUMN credit_note_uploaded_at TIMESTAMP WITH TIME ZONE;
```

### 4. project_estimations (Overpayment Detection)
```sql
-- Added
ALTER TABLE project_estimations
ADD COLUMN has_overpayment BOOLEAN DEFAULT FALSE,
ADD COLUMN overpayment_amount NUMERIC(20,2) DEFAULT 0.00,
ADD COLUMN overpayment_status TEXT CHECK (overpayment_status IN ('pending_approval', 'approved', 'rejected', NULL));
```

### 5. customer_payments_in
```sql
-- Added for payment tracking with GST
ALTER TABLE customer_payments_in
ADD COLUMN pre_tax_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN gst_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN gst_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN credit_note_url TEXT;

-- Updated constraint (removed restrictive payment types)
ALTER TABLE customer_payments_in DROP CONSTRAINT customer_payments_in_payment_type_check;
ALTER TABLE customer_payments_in 
ADD CONSTRAINT customer_payments_in_payment_type_check 
CHECK (payment_type IS NOT NULL AND length(payment_type) > 0);
```

---

## Complete Schema File Generated

A complete, up-to-date schema dump has been created:
**File:** `/app/complete_schema.sql`

This file contains:
✅ All table definitions
✅ All indexes
✅ All constraints
✅ All sequences
✅ All functions/triggers
✅ Complete current state of database

---

## Recommended Actions

### Option 1: Use Complete Schema Dump (Recommended)
**Pros:** 
- Single source of truth
- Guaranteed to match current database
- Easy to restore

**Cons:**
- Loses migration history
- Harder to see incremental changes

**How to use:**
```bash
# Fresh installation
psql -U username -d database_name -f complete_schema.sql

# Then add seed data if needed
```

### Option 2: Create Migration Files
Create incremental migration files for tracking:

**File:** `migration_003_milestone_percentages.sql`
```sql
-- Add woodwork and misc percentages to milestones
ALTER TABLE biz_model_milestones
ADD COLUMN IF NOT EXISTS woodwork_percentage NUMERIC(9,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS misc_percentage NUMERIC(9,4) DEFAULT 0;

-- Remove old default_percentage
ALTER TABLE biz_model_milestones 
DROP COLUMN IF EXISTS default_percentage;
```

**File:** `migration_004_bizmodel_status.sql`
```sql
-- Add status to biz_models
ALTER TABLE biz_models
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_biz_models_status ON biz_models(status);
```

**File:** `migration_005_overpayment_handling.sql`
```sql
-- Add overpayment tracking to projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS customer_credit NUMERIC(20,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credit_note_url TEXT,
ADD COLUMN IF NOT EXISTS credit_note_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add overpayment detection to estimations
ALTER TABLE project_estimations
ADD COLUMN IF NOT EXISTS has_overpayment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overpayment_amount NUMERIC(20,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overpayment_status TEXT CHECK (overpayment_status IN ('pending_approval', 'approved', 'rejected', NULL));

-- Add credit note tracking to payments
ALTER TABLE customer_payments_in
ADD COLUMN IF NOT EXISTS credit_note_url TEXT;
```

**File:** `migration_006_payment_gst_tracking.sql`
```sql
-- Add GST tracking to payments
ALTER TABLE customer_payments_in
ADD COLUMN IF NOT EXISTS pre_tax_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 0;

-- Update payment_type constraint
ALTER TABLE customer_payments_in DROP CONSTRAINT IF EXISTS customer_payments_in_payment_type_check;
ALTER TABLE customer_payments_in 
ADD CONSTRAINT customer_payments_in_payment_type_check 
CHECK (payment_type IS NOT NULL AND length(payment_type) > 0);
```

---

## What Should Be in GitHub

### Recommended Structure:

```
/database/
├── schema/
│   ├── complete_schema.sql          # Full schema dump (for fresh install)
│   └── README.md                     # Schema documentation
├── migrations/
│   ├── 001_init_schema.sql
│   ├── 002_biz_model_schema.sql
│   ├── 003_milestone_percentages.sql
│   ├── 004_bizmodel_status.sql
│   ├── 005_overpayment_handling.sql
│   └── 006_payment_gst_tracking.sql
└── seeds/
    └── default_data.sql              # Optional seed data
```

---

## How to Update GitHub

### Step 1: Add Complete Schema
```bash
git add complete_schema.sql
git commit -m "Add complete up-to-date PostgreSQL schema"
```

### Step 2: (Optional) Add Migration Files
Create the migration files listed above and add them:
```bash
git add migration_*.sql
git commit -m "Add incremental migration files for schema changes"
```

### Step 3: Update README
Add a section in your README explaining:
- How to set up the database from scratch
- How to apply migrations
- Schema versioning strategy

---

## Quick Setup Commands (For New Installations)

### Using Complete Schema:
```bash
# Create database
createdb kg_erp

# Apply schema
psql -d kg_erp -f complete_schema.sql

# (Optional) Add seed data
# psql -d kg_erp -f seeds/default_data.sql
```

### Using Migrations:
```bash
# Create database
createdb kg_erp

# Apply migrations in order
psql -d kg_erp -f migrations/001_init_schema.sql
psql -d kg_erp -f migrations/002_biz_model_schema.sql
psql -d kg_erp -f migrations/003_milestone_percentages.sql
psql -d kg_erp -f migrations/004_bizmodel_status.sql
psql -d kg_erp -f migrations/005_overpayment_handling.sql
psql -d kg_erp -f migrations/006_payment_gst_tracking.sql
```

---

## Summary

**Current Status:** ❌ GitHub schema is **OUT OF DATE**

**Action Required:**
1. Commit `/app/complete_schema.sql` to GitHub
2. (Optional) Create and commit migration files
3. Update README with setup instructions

**Files to Commit:**
- ✅ `complete_schema.sql` (generated, ready to commit)
- ⏳ Migration files (need to be created from content above)
- ⏳ Updated README.md with database setup instructions
