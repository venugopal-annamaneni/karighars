# Stable Item ID for Estimation Items - Implementation Analysis

## Executive Summary

Introduce `stable_item_id` to `estimation_items` table (similar to `purchase_request_items`) to:
1. Track logical items across estimation versions
2. Make PR-to-estimation links version-independent
3. Enable better audit trails and version comparisons

---

## Current Architecture Analysis

### 1. Estimation Versioning (Current State)

**How it works now:**
```javascript
// From /app/app/api/projects/[id]/estimations/route.js

// Get next version number
const nextVersion = COALESCE(MAX(version), 0) + 1;

// Make all existing estimations inactive
UPDATE project_estimations SET is_active = false WHERE project_id = X;

// Create new estimation
INSERT INTO project_estimations (project_id, version, ...) VALUES (...);

// Insert NEW estimation items (with new IDs!)
for (const item of body.items) {
  INSERT INTO estimation_items (estimation_id, category, item_name, ...) VALUES (...);
}
```

**Problem:**
- Every new version creates entirely new `estimation_items` records
- New records get new `id` values
- No way to track "Item A in V1" is the same as "Item A in V2"

### 2. Purchase Request Links (Current State)

**Schema:**
```sql
CREATE TABLE purchase_request_estimation_links (
    id SERIAL PRIMARY KEY,
    estimation_item_id INTEGER NOT NULL REFERENCES estimation_items(id),
    purchase_request_item_id INTEGER NOT NULL REFERENCES purchase_request_items(id),
    linked_qty NUMERIC(10,2) NOT NULL,
    unit_purchase_request_item_weightage NUMERIC(5,4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ...
);
```

**Problem:**
- Links reference `estimation_item_id` (the `id` column)
- If estimation gets a new version, item IDs change
- Links point to old version's items
- Example:
  ```
  Version 1: Item "TV Unit" has id=100
  PR created: Links to estimation_item_id=100 ✓
  
  Version 2: Same "TV Unit" now has id=250
  PR still links to estimation_item_id=100 (old version!) ✗
  ```

### 3. Estimation Items Table (Current State)

```sql
CREATE TABLE estimation_items (
    id INTEGER PRIMARY KEY,  -- Changes with every version
    estimation_id INTEGER REFERENCES project_estimations(id),
    category TEXT,
    room_name VARCHAR NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC,
    unit_price NUMERIC,
    ...
    -- NO stable_item_id!
);
```

**Missing:**
- No persistent identifier across versions
- Can't track item history
- Can't maintain stable references

---

## Proposed Architecture

### 1. Add stable_item_id to estimation_items

```sql
ALTER TABLE estimation_items
  ADD COLUMN stable_item_id UUID DEFAULT gen_random_uuid() NOT NULL;

CREATE INDEX idx_estimation_items_stable_id ON estimation_items(stable_item_id);
```

**Benefits:**
- `id` = physical record identifier (changes per version)
- `stable_item_id` = logical item identifier (persists across versions)

### 2. Update purchase_request_estimation_links

**Option A: Replace column (Breaking Change)**
```sql
-- Drop old column, add new one
ALTER TABLE purchase_request_estimation_links
  DROP COLUMN estimation_item_id,
  ADD COLUMN stable_estimation_item_id UUID NOT NULL REFERENCES estimation_items(stable_item_id);
```

**Option B: Gradual Migration (Recommended)**
```sql
-- Add new column alongside old one
ALTER TABLE purchase_request_estimation_links
  ADD COLUMN stable_estimation_item_id UUID REFERENCES estimation_items(stable_item_id);

-- Backfill from existing links
UPDATE purchase_request_estimation_links prel
SET stable_estimation_item_id = ei.stable_item_id
FROM estimation_items ei
WHERE prel.estimation_item_id = ei.id;

-- Make it NOT NULL after backfill
ALTER TABLE purchase_request_estimation_links
  ALTER COLUMN stable_estimation_item_id SET NOT NULL;

-- Later: Drop old column
-- ALTER TABLE purchase_request_estimation_links DROP COLUMN estimation_item_id;
```

### 3. Versioning Behavior

**Creating Version 1:**
```javascript
for (const item of body.items) {
  // Generate new stable_item_id for each item
  INSERT INTO estimation_items (
    estimation_id, 
    stable_item_id,  -- NEW: Auto-generated UUID
    category, 
    item_name, 
    quantity, 
    ...
  ) VALUES (...);
}
```

**Creating Version 2 (Edit):**
```javascript
// User edits estimation
// Frontend sends items with their stable_item_ids

for (const item of body.items) {
  INSERT INTO estimation_items (
    estimation_id, 
    stable_item_id,  -- PRESERVE: Same UUID as V1
    category, 
    item_name, 
    quantity,  -- May be updated
    ...
  ) VALUES (...);
}
```

**Result:**
```
Version 1:
- TV Unit: id=100, stable_item_id=uuid-A
- Wardrobe: id=101, stable_item_id=uuid-B

Version 2 (after edit):
- TV Unit: id=250, stable_item_id=uuid-A (SAME!)
- Wardrobe: id=251, stable_item_id=uuid-B (SAME!)
- Kitchen Cabinet: id=252, stable_item_id=uuid-C (NEW!)
```

---

## Implementation Plan

### Phase 1: Database Schema Changes

**Migration 021: Add stable_item_id to estimation_items**
```sql
-- Add column with default UUID generation
ALTER TABLE estimation_items
  ADD COLUMN stable_item_id UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add index for performance
CREATE INDEX idx_estimation_items_stable_id ON estimation_items(stable_item_id);

-- Add comment
COMMENT ON COLUMN estimation_items.stable_item_id IS 
  'Stable identifier that persists across estimation versions for tracking the same logical item';
```

**Migration 022: Add stable_estimation_item_id to links**
```sql
-- Add new column (nullable initially)
ALTER TABLE purchase_request_estimation_links
  ADD COLUMN stable_estimation_item_id UUID;

-- Add foreign key
ALTER TABLE purchase_request_estimation_links
  ADD CONSTRAINT fk_stable_estimation_item_id 
  FOREIGN KEY (stable_estimation_item_id) 
  REFERENCES estimation_items(stable_item_id);

-- Backfill existing links
UPDATE purchase_request_estimation_links prel
SET stable_estimation_item_id = ei.stable_item_id
FROM estimation_items ei
WHERE prel.estimation_item_id = ei.id;

-- Make it NOT NULL
ALTER TABLE purchase_request_estimation_links
  ALTER COLUMN stable_estimation_item_id SET NOT NULL;

-- Add index
CREATE INDEX idx_pr_links_stable_estimation_item ON 
  purchase_request_estimation_links(stable_estimation_item_id);

-- Add comment
COMMENT ON COLUMN purchase_request_estimation_links.stable_estimation_item_id IS 
  'References the logical estimation item across versions, making links version-independent';
```

### Phase 2: Backend Code Changes

#### 2.1 Estimation Creation (`/app/app/api/projects/[id]/estimations/route.js`)

**Current (Version 1):**
```javascript
for (const item of body.items) {
  await query(`
    INSERT INTO estimation_items (
      estimation_id, category, room_name, item_name, quantity, ...
    ) VALUES ($1, $2, $3, $4, $5, ...)
  `, [estimationId, item.category, item.room_name, item.item_name, item.quantity, ...]);
}
```

**Updated:**
```javascript
for (const item of body.items) {
  // For new items, stable_item_id will be auto-generated by DEFAULT gen_random_uuid()
  // For items from previous version, use the existing stable_item_id
  const stableItemId = item.stable_item_id || null; // null = DB generates new UUID
  
  await query(`
    INSERT INTO estimation_items (
      estimation_id, stable_item_id, category, room_name, item_name, quantity, ...
    ) VALUES ($1, $2, $3, $4, $5, $6, ...)
  `, [
    estimationId, 
    stableItemId,  // NEW: Preserve or generate
    item.category, 
    item.room_name, 
    item.item_name, 
    item.quantity, 
    ...
  ]);
}
```

#### 2.2 PR Creation (`/app/app/api/projects/[id]/purchase-requests/route.js`)

**Current:**
```javascript
await query(`
  INSERT INTO purchase_request_estimation_links (
    estimation_item_id,
    purchase_request_item_id,
    stable_item_id,
    version,
    linked_qty,
    unit_purchase_request_item_weightage,
    notes
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [
  link.estimation_item_id,  // OLD: points to specific version
  prItemId,
  stableItemId,
  1,
  link.linked_qty,
  link.weightage,
  link.notes
]);
```

**Updated:**
```javascript
// Get stable_estimation_item_id from estimation_item_id
const estItemResult = await query(`
  SELECT stable_item_id FROM estimation_items WHERE id = $1
`, [link.estimation_item_id]);

const stableEstimationItemId = estItemResult.rows[0].stable_item_id;

await query(`
  INSERT INTO purchase_request_estimation_links (
    estimation_item_id,  -- Keep for backward compatibility
    stable_estimation_item_id,  -- NEW: version-independent
    purchase_request_item_id,
    stable_item_id,
    version,
    linked_qty,
    unit_purchase_request_item_weightage,
    notes
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [
  link.estimation_item_id,
  stableEstimationItemId,  // NEW
  prItemId,
  stableItemId,
  1,
  link.linked_qty,
  link.weightage,
  link.notes
]);
```

#### 2.3 PR Versioning (`/app/lib/versioning-utils.js`)

**Current:**
```javascript
// When re-inserting links
await query(`
  INSERT INTO purchase_request_estimation_links (
    stable_item_id,
    version,
    estimation_item_id,
    purchase_request_item_id,
    linked_qty,
    unit_purchase_request_item_weightage,
    notes
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [
  itemData.stable_item_id,
  newVersion,
  link.estimation_item_id,  // OLD: may be stale
  newPurchaseRequestItemId,
  link.linked_qty,
  link.weightage,
  link.notes
]);
```

**Updated:**
```javascript
// When re-inserting links
await query(`
  INSERT INTO purchase_request_estimation_links (
    stable_item_id,
    version,
    estimation_item_id,  -- Keep for backward compatibility
    stable_estimation_item_id,  -- NEW: always valid
    purchase_request_item_id,
    linked_qty,
    unit_purchase_request_item_weightage,
    notes
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [
  itemData.stable_item_id,
  newVersion,
  link.estimation_item_id,  // OLD
  link.stable_estimation_item_id,  // NEW: preserved from payload
  newPurchaseRequestItemId,
  link.linked_qty,
  link.weightage,
  link.notes
]);
```

#### 2.4 Queries Fetching PR Details

**Current:**
```javascript
SELECT 
  prel.*,
  ei.item_name as estimation_item_name,
  ei.category as estimation_item_category,
  ei.room as estimation_item_room
FROM purchase_request_estimation_links prel
JOIN estimation_items ei ON prel.estimation_item_id = ei.id
WHERE prel.stable_item_id = ?
```

**Updated:**
```javascript
SELECT 
  prel.*,
  ei.item_name as estimation_item_name,
  ei.category as estimation_item_category,
  ei.room as estimation_item_room
FROM purchase_request_estimation_links prel
JOIN estimation_items ei ON prel.stable_estimation_item_id = ei.stable_item_id
WHERE prel.stable_item_id = ?
  AND ei.estimation_id = (
    SELECT id FROM project_estimations 
    WHERE project_id = ? AND is_active = true
  )
```

**Key Change:** Join on `stable_item_id` and filter for active estimation version

### Phase 3: Frontend Changes

#### 3.1 Estimation Edit Flow

**Need to implement:**
1. When user edits an estimation, fetch current items with their `stable_item_id`
2. Allow user to edit/delete/add items
3. When saving, preserve `stable_item_id` for existing items
4. Generate new `stable_item_id` for newly added items (or let DB do it)

**Example payload:**
```javascript
{
  "items": [
    {
      "stable_item_id": "uuid-A",  // Existing item, preserve ID
      "item_name": "TV Unit",
      "quantity": 60,  // Updated quantity
      ...
    },
    {
      "stable_item_id": "uuid-B",  // Existing item, preserve ID
      "item_name": "Wardrobe",
      "quantity": 100,
      ...
    },
    {
      // No stable_item_id = new item, DB will generate one
      "item_name": "Kitchen Cabinet",
      "quantity": 50,
      ...
    }
  ]
}
```

---

## Key Design Decisions

### 1. Keep Both IDs During Transition?

**Recommendation: YES (Option B)**
- Keep `estimation_item_id` for backward compatibility
- Add `stable_estimation_item_id` as the new standard
- Gradually migrate all queries
- Drop old column in future release

**Pros:**
- No breaking changes
- Safe rollback
- Time to test thoroughly

**Cons:**
- Temporary redundancy
- Need to maintain both columns

### 2. Join Strategy for Active Items

When fetching PR details, always join to the **active estimation version**:

```sql
FROM purchase_request_estimation_links prel
JOIN estimation_items ei 
  ON prel.stable_estimation_item_id = ei.stable_item_id
JOIN project_estimations pe 
  ON ei.estimation_id = pe.id
WHERE pe.is_active = true
  AND prel.stable_item_id = ?
```

**Benefit:** Links automatically resolve to latest estimation data

### 3. Handling Deleted Estimation Items

**Scenario:** Item exists in Version 1, deleted in Version 2, PR still references it

**Solution:**
- `stable_estimation_item_id` remains valid
- Query should handle missing items gracefully
- Show "(Item no longer in estimation)" in UI
- Or join to history if we implement `estimation_items_history`

### 4. Do We Need estimation_items_history?

**Current:** No history table for estimation items

**Options:**
1. **Don't create history table:** Old versions preserved in `estimation_items` table (inactive estimations)
2. **Create history table:** Move old items to history when creating new version

**Recommendation: Option 1 (for now)**
- Current architecture keeps old estimation records
- No need for separate history table yet
- Can add later if needed

---

## Benefits Summary

### 1. Link Stability ✅
```
Before: PR links to estimation_item_id=100 (Version 1)
        User creates Version 2 → Item now has id=250
        Link is stale/broken

After:  PR links to stable_estimation_item_id=uuid-A
        User creates Version 2 → Item still has stable_item_id=uuid-A
        Link remains valid!
```

### 2. Audit Trail ✅
```sql
-- Track item changes across versions
SELECT 
  pe.version,
  ei.item_name,
  ei.quantity,
  ei.unit_price
FROM estimation_items ei
JOIN project_estimations pe ON ei.estimation_id = pe.id
WHERE ei.stable_item_id = 'uuid-A'
ORDER BY pe.version;

-- Result:
-- version | item_name | quantity | unit_price
-- 1       | TV Unit   | 50       | 1500
-- 2       | TV Unit   | 60       | 1500  (quantity changed)
-- 3       | TV Unit   | 60       | 1800  (price changed)
```

### 3. Version Comparison ✅
```javascript
// Compare two estimation versions
const v1Items = await query(`
  SELECT * FROM estimation_items 
  WHERE estimation_id = (SELECT id FROM project_estimations WHERE version = 1)
`);

const v2Items = await query(`
  SELECT * FROM estimation_items 
  WHERE estimation_id = (SELECT id FROM project_estimations WHERE version = 2)
`);

// Match items by stable_item_id
const comparison = compareVersions(v1Items, v2Items);
// Shows: added items, deleted items, modified items
```

### 4. Consistent Architecture ✅
- `purchase_request_items` has `stable_item_id` ✓
- `estimation_items` has `stable_item_id` ✓
- Both use same versioning pattern ✓
- Easier to understand and maintain ✓

---

## Risks & Mitigation

### Risk 1: Existing PRs Reference Old estimation_item_id

**Mitigation:**
- Keep `estimation_item_id` column during transition
- Backfill `stable_estimation_item_id` for existing links
- Update queries to use stable ID with fallback to old ID

### Risk 2: Performance Impact (Extra JOINs)

**Mitigation:**
- Add indexes on `stable_item_id` columns
- Most queries already join estimation_items
- Minimal impact expected

### Risk 3: Frontend Doesn't Send stable_item_id

**Mitigation:**
- Make `stable_item_id` optional in backend
- If not provided, DB generates new UUID (DEFAULT gen_random_uuid())
- Gradually update frontend to send IDs

### Risk 4: Confusion Between id and stable_item_id

**Mitigation:**
- Clear documentation
- Code comments explaining usage
- Naming convention: `stable_*` prefix makes purpose clear

---

## Testing Strategy

### 1. Database Migration Testing
- [ ] Run migration 021 on test database
- [ ] Verify all existing items get UUIDs
- [ ] Run migration 022 on test database
- [ ] Verify backfill populates stable_estimation_item_id
- [ ] Test queries with new columns

### 2. Estimation Creation Testing
- [ ] Create new estimation (Version 1)
- [ ] Verify items have stable_item_id
- [ ] Create PR from estimation
- [ ] Verify links have stable_estimation_item_id

### 3. Estimation Versioning Testing
- [ ] Edit estimation to create Version 2
- [ ] Verify items preserve stable_item_id
- [ ] Verify new items get new stable_item_id
- [ ] Verify deleted items not in Version 2

### 4. PR Link Stability Testing
- [ ] Create PR from Version 1
- [ ] Edit estimation to create Version 2
- [ ] View PR details
- [ ] Verify links resolve to Version 2 items
- [ ] Verify no broken references

### 5. Edge Cases
- [ ] Estimation with no items
- [ ] Item deleted then re-added (new stable_item_id?)
- [ ] PR created from inactive estimation
- [ ] Multiple PRs linking to same estimation item

---

## Migration File Checklist

### Migration 021: Add stable_item_id to estimation_items
- [ ] Add column with UUID type
- [ ] Set DEFAULT gen_random_uuid()
- [ ] Set NOT NULL
- [ ] Create index on stable_item_id
- [ ] Add table/column comments
- [ ] Verify existing items get UUIDs

### Migration 022: Add stable_estimation_item_id to links
- [ ] Add column (nullable)
- [ ] Add foreign key constraint
- [ ] Backfill from estimation_items
- [ ] Set NOT NULL
- [ ] Create index
- [ ] Add column comment
- [ ] Test join queries

---

## Rollback Plan

### If Issues Found:

**Step 1: Stop using new columns in code**
```sql
-- Revert queries to use old estimation_item_id
```

**Step 2: Keep columns but don't rely on them**
- Old code path still works
- New columns are populated but not used

**Step 3: If needed, remove columns**
```sql
ALTER TABLE purchase_request_estimation_links
  DROP COLUMN stable_estimation_item_id;

ALTER TABLE estimation_items
  DROP COLUMN stable_item_id;
```

**Step 4: Rollback code changes**
- Revert to previous commit
- Deploy old version

---

## Timeline Estimate

- **Phase 1 (Database):** 1-2 hours
  - Write migrations
  - Test on dev database
  - Execute on production

- **Phase 2 (Backend):** 4-6 hours
  - Update estimation creation
  - Update PR creation
  - Update PR versioning
  - Update all queries
  - Test each endpoint

- **Phase 3 (Frontend):** 2-4 hours
  - Update estimation edit UI
  - Send stable_item_id in payloads
  - Test end-to-end flow

- **Phase 4 (Testing):** 4-6 hours
  - Comprehensive testing
  - Edge cases
  - Performance testing

**Total: 12-18 hours of development + testing**

---

## Conclusion

This is a **high-value architectural improvement** that:
- ✅ Fixes a real problem (stale links after estimation edits)
- ✅ Aligns with existing patterns (PR items versioning)
- ✅ Enables better audit trails and comparisons
- ✅ Minimal breaking changes with gradual migration

**Recommendation: Proceed with implementation using Option B (gradual migration)**

This approach is safe, maintainable, and provides immediate benefits while maintaining backward compatibility.
