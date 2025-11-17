# Estimation Items History Table - Approach Analysis

## Problem Statement

**Error:** `duplicate key value violates unique constraint "uq_estimation_items_stable_id"`

**Root Cause:**
```
V1: estimation_items contains:
- id=1001, stable_item_id=uuid-A, estimation_id=100

V2: Try to insert:
- id=2001, stable_item_id=uuid-A, estimation_id=200

Error: uuid-A already exists in the table (UNIQUE constraint)
```

**Why This Happens:**
- We added `UNIQUE` constraint on `stable_item_id` in migration 021
- When creating new estimation version, old items remain in `estimation_items` table
- Old project_estimations just marked `is_active=false`, but items still present
- New version tries to insert items with same `stable_item_id` → conflict!

---

## Current vs Desired Architecture

### Current Architecture (Broken)
```
estimation_items table:
- V1 items: estimation_id=100 (is_active=false on project_estimations)
- V2 items: Can't insert! stable_item_id conflicts with V1

Problem: All versions share the same table
```

### Desired Architecture (Like PR Items)
```
estimation_items table:
- Only V2 items (current/active version)

estimation_items_history table:
- V1 items (archived)
- When V3 created, V2 items move here

Pattern: Current table = active only, History = all past versions
```

---

## Proposed Solution

### Approach: Create History Table & Move-Delete-Insert Pattern

This mirrors the **exact pattern** used for `purchase_request_items`:

1. **Create `estimation_items_history` table**
2. **Before inserting new version:** Move old items to history, delete from current
3. **Insert new version items:** No conflicts now!
4. **Query active items:** Just query `estimation_items` (no JOIN needed)
5. **Query history:** Use `estimation_items_history` with `archived_at`

---

## Implementation Plan

### Phase 1: Create estimation_items_history Table

**Migration 023: Create estimation_items_history**

```sql
-- Create history table with same structure as current table
CREATE TABLE estimation_items_history (
    -- Identifiers & Relations
    id INTEGER NOT NULL,  -- Original id from estimation_items
    stable_item_id UUID NOT NULL,
    estimation_id INTEGER NOT NULL,
    
    -- Item Details
    category TEXT,
    room_name VARCHAR NOT NULL,
    vendor_type VARCHAR,
    item_name TEXT NOT NULL,
    
    -- Dimensions & Quantity
    unit VARCHAR DEFAULT 'sqft',
    width NUMERIC,
    height NUMERIC,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    
    -- Pricing
    subtotal NUMERIC NOT NULL,
    karighar_charges_percentage NUMERIC DEFAULT 10,
    karighar_charges_amount NUMERIC DEFAULT 0,
    item_discount_percentage NUMERIC DEFAULT 0,
    item_discount_amount NUMERIC DEFAULT 0,
    discount_kg_charges_percentage NUMERIC DEFAULT 0,
    discount_kg_charges_amount NUMERIC DEFAULT 0,
    gst_percentage NUMERIC NOT NULL,
    gst_amount NUMERIC DEFAULT 0,
    amount_before_gst NUMERIC DEFAULT 0,
    item_total NUMERIC DEFAULT 0,
    
    -- Status
    status VARCHAR DEFAULT 'queued',
    
    -- Audit Fields
    created_at TIMESTAMPTZ,
    created_by INTEGER,
    updated_at TIMESTAMPTZ,
    updated_by INTEGER,
    
    -- History-Specific Fields
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by INTEGER,
    
    -- Primary key is composite (id + archived_at) to allow same id in multiple versions
    PRIMARY KEY (id, archived_at)
);

-- Indexes for querying history
CREATE INDEX idx_estimation_items_history_stable_id ON estimation_items_history(stable_item_id);
CREATE INDEX idx_estimation_items_history_estimation_id ON estimation_items_history(estimation_id);
CREATE INDEX idx_estimation_items_history_archived_at ON estimation_items_history(archived_at);

-- Comment
COMMENT ON TABLE estimation_items_history IS 
  'Complete audit trail of all estimation item versions. Items are moved here when a new estimation version is created.';
```

**Note:** No UNIQUE constraint on stable_item_id in history (same item can appear multiple times across versions)

---

### Phase 2: Update Estimation Creation Logic

**File:** `/app/app/api/projects/[id]/estimations/route.js`

**Current Flow:**
```javascript
// Get next version
const nextVersion = COALESCE(MAX(version), 0) + 1;

// Mark old estimations inactive
UPDATE project_estimations SET is_active = false WHERE project_id = X;

// Create new estimation
INSERT INTO project_estimations (...);

// Insert items
for (const item of body.items) {
  INSERT INTO estimation_items (...);  // ❌ Conflicts with old items!
}
```

**New Flow:**
```javascript
// 1. Get current version
const versionResult = await query(`
  SELECT id, version 
  FROM project_estimations 
  WHERE project_id = $1 AND is_active = true
`, [projectId]);

const currentEstimationId = versionResult.rows[0]?.id;
const currentVersion = versionResult.rows[0]?.version || 0;

// 2. If there's an existing estimation, archive its items
if (currentEstimationId) {
  // Move current items to history
  await query(`
    INSERT INTO estimation_items_history (
      id, stable_item_id, estimation_id,
      category, room_name, vendor_type, item_name,
      unit, width, height, quantity, unit_price,
      subtotal, karighar_charges_percentage, karighar_charges_amount,
      item_discount_percentage, item_discount_amount,
      discount_kg_charges_percentage, discount_kg_charges_amount,
      gst_percentage, gst_amount, amount_before_gst, item_total,
      status, created_at, created_by, updated_at, updated_by,
      archived_at, archived_by
    )
    SELECT 
      id, stable_item_id, estimation_id,
      category, room_name, vendor_type, item_name,
      unit, width, height, quantity, unit_price,
      subtotal, karighar_charges_percentage, karighar_charges_amount,
      item_discount_percentage, item_discount_amount,
      discount_kg_charges_percentage, discount_kg_charges_amount,
      gst_percentage, gst_amount, amount_before_gst, item_total,
      status, created_at, created_by, updated_at, updated_by,
      NOW(), $2
    FROM estimation_items
    WHERE estimation_id = $1
  `, [currentEstimationId, session.user.id]);
  
  // Delete current items
  await query(`
    DELETE FROM estimation_items WHERE estimation_id = $1
  `, [currentEstimationId]);
}

// 3. Mark old estimation inactive
await query(`
  UPDATE project_estimations 
  SET is_active = false 
  WHERE project_id = $1
`, [projectId]);

// 4. Create new estimation
const nextVersion = currentVersion + 1;
const estimationResult = await query(`
  INSERT INTO project_estimations (
    project_id, version, is_active, ...
  ) VALUES ($1, $2, true, ...)
  RETURNING id
`, [projectId, nextVersion, ...]);

const newEstimationId = estimationResult.rows[0].id;

// 5. Insert new items (no conflicts now!)
for (const item of body.items) {
  const stableItemId = item.stable_item_id || null;
  
  await query(`
    INSERT INTO estimation_items (
      estimation_id, stable_item_id, category, room_name, ...
    ) VALUES ($1, $2, $3, $4, ...)
  `, [newEstimationId, stableItemId, ...]);
}
```

---

## Data Flow Example

### Creating Version 1 (First Time)

**User Action:** Create first estimation

**Backend Process:**
```sql
-- Check for existing estimation
SELECT id, version FROM project_estimations 
WHERE project_id = 1 AND is_active = true;
-- Result: No rows (first estimation)

-- No archiving needed

-- Create estimation
INSERT INTO project_estimations (project_id, version, is_active)
VALUES (1, 1, true);
-- Returns: estimation_id = 100

-- Insert items
INSERT INTO estimation_items (estimation_id, stable_item_id, item_name, ...)
VALUES (100, DEFAULT, 'TV Unit', ...);  -- Gets uuid-A
VALUES (100, DEFAULT, 'Wardrobe', ...);  -- Gets uuid-B
```

**Result:**
```
project_estimations:
- id=100, project_id=1, version=1, is_active=true

estimation_items:
- id=1001, stable_item_id=uuid-A, estimation_id=100, item_name='TV Unit'
- id=1002, stable_item_id=uuid-B, estimation_id=100, item_name='Wardrobe'

estimation_items_history:
- (empty)
```

---

### Creating Version 2 (Edit)

**User Action:** Edit estimation (change TV Unit quantity, add Bookshelf)

**Frontend Sends:**
```json
{
  "items": [
    { "stable_item_id": "uuid-A", "item_name": "TV Unit", "quantity": 60 },
    { "stable_item_id": "uuid-B", "item_name": "Wardrobe", "quantity": 100 },
    { "item_name": "Bookshelf", "quantity": 20 }  // No stable_item_id = new
  ]
}
```

**Backend Process:**
```sql
-- 1. Get current estimation
SELECT id, version FROM project_estimations 
WHERE project_id = 1 AND is_active = true;
-- Result: id=100, version=1

-- 2. Move items to history
INSERT INTO estimation_items_history (
  id, stable_item_id, estimation_id, item_name, ..., archived_at, archived_by
)
SELECT 
  id, stable_item_id, estimation_id, item_name, ..., NOW(), 5
FROM estimation_items
WHERE estimation_id = 100;
-- Copies: 1001/uuid-A, 1002/uuid-B

-- 3. Delete current items
DELETE FROM estimation_items WHERE estimation_id = 100;
-- Deletes: 1001, 1002 from current table

-- 4. Mark old estimation inactive
UPDATE project_estimations SET is_active = false WHERE project_id = 1;

-- 5. Create new estimation
INSERT INTO project_estimations (project_id, version, is_active)
VALUES (1, 2, true);
-- Returns: estimation_id = 200

-- 6. Insert new items
INSERT INTO estimation_items (estimation_id, stable_item_id, item_name, ...)
VALUES (200, 'uuid-A', 'TV Unit', 60);  -- Preserves stable_item_id
VALUES (200, 'uuid-B', 'Wardrobe', 100);  -- Preserves stable_item_id
VALUES (200, DEFAULT, 'Bookshelf', 20);  -- Gets new uuid-C
```

**Result:**
```
project_estimations:
- id=100, project_id=1, version=1, is_active=false  (archived)
- id=200, project_id=1, version=2, is_active=true   (current)

estimation_items (current table):
- id=2001, stable_item_id=uuid-A, estimation_id=200, item_name='TV Unit', qty=60
- id=2002, stable_item_id=uuid-B, estimation_id=200, item_name='Wardrobe', qty=100
- id=2003, stable_item_id=uuid-C, estimation_id=200, item_name='Bookshelf', qty=20

estimation_items_history:
- id=1001, stable_item_id=uuid-A, estimation_id=100, item_name='TV Unit', qty=50, archived_at=...
- id=1002, stable_item_id=uuid-B, estimation_id=100, item_name='Wardrobe', qty=100, archived_at=...
```

**No Conflicts!** Old items in history, new items in current table.

---

## Querying Patterns

### Get Active Items (Most Common)
```sql
-- Simple query, no joins
SELECT * FROM estimation_items
WHERE estimation_id = (
  SELECT id FROM project_estimations 
  WHERE project_id = 1 AND is_active = true
);
```

### Get Items for Specific Version
```sql
-- For archived versions, query history
SELECT * FROM estimation_items_history
WHERE estimation_id = 100;  -- V1

-- For current version, query current table
SELECT * FROM estimation_items
WHERE estimation_id = 200;  -- V2 (current)
```

### Track Item Across Versions
```sql
-- Get all versions of an item
(
  SELECT *, 'current' as source
  FROM estimation_items
  WHERE stable_item_id = 'uuid-A'
)
UNION ALL
(
  SELECT *, 'history' as source
  FROM estimation_items_history
  WHERE stable_item_id = 'uuid-A'
)
ORDER BY estimation_id;

-- Result:
-- V1: qty=50 (from history)
-- V2: qty=60 (from current)
```

### Compare Two Versions
```sql
-- Get V1 items
SELECT stable_item_id, item_name, quantity
FROM estimation_items_history
WHERE estimation_id = 100;

-- Get V2 items
SELECT stable_item_id, item_name, quantity
FROM estimation_items
WHERE estimation_id = 200;

-- Application compares by stable_item_id
```

---

## Benefits

### 1. No UNIQUE Constraint Conflicts ✅
```
Before: All versions in one table → stable_item_id conflicts
After: One version per table → no conflicts
```

### 2. Consistent Architecture ✅
```
purchase_request_items + purchase_request_items_history ✓
estimation_items + estimation_items_history ✓

Same pattern, easier to understand!
```

### 3. Simple Queries ✅
```
Get active items: SELECT * FROM estimation_items WHERE estimation_id = X
No need for: WHERE deleted_at IS NULL or other filters
```

### 4. Complete Audit Trail ✅
```
History table has archived_at, archived_by
Can see when and who created each version
Full audit compliance
```

### 5. Performance Optimization ✅
```
Current table: Small (only active version)
History table: Large (all past versions)
Fast queries on active data!
```

---

## Migration Strategy

### Step 1: Create History Table
- Migration 023 creates `estimation_items_history`
- Run migration on empty database (data already truncated)

### Step 2: Update Backend Code
- Modify estimation creation to archive old items first
- Add move-to-history logic
- Add delete-from-current logic
- Then insert new items

### Step 3: Test Flow
- Create V1 → items in current table
- Create V2 → V1 items move to history, V2 items in current
- Create V3 → V2 items move to history, V3 items in current
- Verify no duplicate key errors

---

## Code Changes Summary

### Files to Modify

**1. New Migration:**
- `/app/migrations/023_create_estimation_items_history.sql`

**2. Backend API:**
- `/app/app/api/projects/[id]/estimations/route.js`
  - Add archive logic before inserting new items
  - Move old items to history
  - Delete old items from current
  - Insert new items

**3. Query Updates (Future):**
- Any queries joining estimation_items may need updates
- Most queries should work as-is (they filter by estimation_id)

---

## Rollback Plan

If issues found:

1. **Keep old items in current table** (don't delete after moving to history)
2. **Update backend** to skip archive step
3. **Drop history table** if needed
4. **Drop unique constraint** on stable_item_id temporarily

---

## Testing Checklist

### Test 1: Create First Estimation ✅
- [ ] Create estimation with 3 items
- [ ] Verify items in `estimation_items`
- [ ] Verify `estimation_items_history` is empty
- [ ] No duplicate key errors

### Test 2: Create Second Version ✅
- [ ] Edit estimation, create V2
- [ ] Verify V1 items moved to history
- [ ] Verify V1 items deleted from current
- [ ] Verify V2 items in current table
- [ ] Same stable_item_id in both versions
- [ ] No duplicate key errors

### Test 3: Create Third Version ✅
- [ ] Edit again, create V3
- [ ] Verify V2 items moved to history
- [ ] Verify V2 items deleted from current
- [ ] Verify V3 items in current table
- [ ] History has both V1 and V2 items
- [ ] No duplicate key errors

### Test 4: PR Links ✅
- [ ] Create PR from V1
- [ ] Create V2
- [ ] View PR details
- [ ] Links still resolve correctly
- [ ] Links point to V2 items via stable_estimation_item_id

---

## Comparison with PR Items Pattern

| Feature | PR Items | Estimation Items (Proposed) |
|---------|----------|----------------------------|
| Current Table | `purchase_request_items` | `estimation_items` |
| History Table | `purchase_request_items_history` | `estimation_items_history` |
| Versioning | Move to history, delete, insert | Move to history, delete, insert |
| Stable ID | `stable_item_id` | `stable_item_id` |
| UNIQUE Constraint | On current table only | On current table only |
| Archived Fields | `archived_at`, `archived_by` | `archived_at`, `archived_by` |
| Query Pattern | Current = active, History = past | Current = active, History = past |

**Result:** ✅ Identical patterns! Easy to understand and maintain.

---

## Recommendation

✅ **Proceed with this approach**

**Why:**
1. Mirrors PR items pattern (consistency)
2. Solves duplicate key error
3. Clean separation of active vs archived
4. Better performance (smaller current table)
5. Complete audit trail preserved
6. No breaking changes to queries (most filter by estimation_id)

**Implementation Time:** 2-3 hours
- Migration: 30 min
- Backend update: 1-2 hours
- Testing: 1 hour

Ready to implement when approved!
