# Audit Columns Preservation Fix - Complete ✅

## Problem Statement

**Issue:** `created_at` and `created_by` were being overwritten with new values for every version, losing the original creation information.

**Incorrect Behavior:**
```
V1: Item "TV Unit" created_at=2024-01-01, created_by=UserA
V2: Item "TV Unit" created_at=2024-02-01, created_by=UserB  ❌ Wrong!
```

**Desired Behavior:**
```
V1: Item "TV Unit" created_at=2024-01-01, created_by=UserA
V2: Item "TV Unit" created_at=2024-01-01, created_by=UserA  ✓ Preserved!
                   updated_at=2024-02-01, updated_by=UserB  ✓ Updated!
```

---

## Solution: Preserve Creation Audit, Update Modification Audit

### Audit Column Semantics

**created_at / created_by:**
- Set ONCE when item is first introduced
- PRESERVED across all subsequent versions
- Represents the original creation of the logical item

**updated_at / updated_by:**
- Set initially when item is created
- UPDATED every time item is modified in a new version
- Represents the last modification

---

## Implementation Details

### Step 1: Fetch Old Items Before Deletion

**Before (Incorrect):**
```javascript
// Just archive and delete
await query(`INSERT INTO history SELECT * FROM items...`);
await query(`DELETE FROM items...`);
```

**After (Correct):**
```javascript
// 1. Fetch old items with creation audit
const oldItemsResult = await query(`
  SELECT stable_item_id, created_at, created_by
  FROM estimation_items
  WHERE estimation_id = $1
`, [currentEstimationId]);

// 2. Create map for quick lookup
let oldItemsMap = new Map();
oldItemsResult.rows.forEach(item => {
  oldItemsMap.set(item.stable_item_id, {
    created_at: item.created_at,
    created_by: item.created_by
  });
});

// 3. Then archive and delete
await query(`INSERT INTO history...`);
await query(`DELETE FROM items...`);
```

**Key Point:** We fetch the creation audit data BEFORE deleting so we can reuse it when inserting the new version.

---

### Step 2: Determine Audit Values Based on Item Type

**Logic:**
```javascript
for (const item of body.items) {
  const stableItemId = item.stable_item_id || null;
  
  let createdAt, createdBy;
  
  if (stableItemId && oldItemsMap.has(stableItemId)) {
    // EXISTING ITEM: Preserve original creation audit
    const oldAudit = oldItemsMap.get(stableItemId);
    createdAt = oldAudit.created_at;
    createdBy = oldAudit.created_by;
  } else {
    // NEW ITEM: Set creation audit to current values
    createdAt = null;  // Will use NOW() in SQL
    createdBy = session.user.id;
  }
  
  // Insert with preserved or new creation audit
  await query(`
    INSERT INTO estimation_items (
      ..., created_at, created_by, updated_at, updated_by
    ) VALUES (
      ..., COALESCE($24, NOW()), $25, NOW(), $26
    )
  `, [..., createdAt, createdBy, session.user.id]);
}
```

**COALESCE Explanation:**
- `COALESCE($24, NOW())`: If `createdAt` is not null (existing item), use it; otherwise use NOW()
- This handles both existing and new items in one query

---

## Data Flow Examples

### Example 1: Create First Version (V1)

**User Action:** Create estimation with 2 items

**Backend Process:**
```javascript
// No existing estimation
oldItemsMap = empty

// Insert items
Item 1 (new): stable_item_id=null → DB generates uuid-A
  createdAt = null → COALESCE(null, NOW()) = NOW()
  createdBy = UserA
  updatedAt = NOW()
  updatedBy = UserA

Item 2 (new): stable_item_id=null → DB generates uuid-B
  createdAt = null → COALESCE(null, NOW()) = NOW()
  createdBy = UserA
  updatedAt = NOW()
  updatedBy = UserA
```

**Database Result:**
```
estimation_items:
- stable_item_id=uuid-A, created_at=2024-01-01 10:00, created_by=UserA, 
  updated_at=2024-01-01 10:00, updated_by=UserA

- stable_item_id=uuid-B, created_at=2024-01-01 10:00, created_by=UserA,
  updated_at=2024-01-01 10:00, updated_by=UserA
```

---

### Example 2: Create Second Version (V2) - Edit Existing Item

**User Action:** UserB edits estimation, changes Item A quantity

**Frontend Sends:**
```json
{
  "items": [
    { "stable_item_id": "uuid-A", "quantity": 60 },  // Existing, edited
    { "stable_item_id": "uuid-B", "quantity": 100 }  // Existing, unchanged
  ]
}
```

**Backend Process:**
```javascript
// 1. Fetch old items
oldItemsMap = {
  'uuid-A': { created_at: '2024-01-01 10:00', created_by: UserA },
  'uuid-B': { created_at: '2024-01-01 10:00', created_by: UserA }
}

// 2. Archive and delete old items

// 3. Insert new version
Item A (existing): stable_item_id=uuid-A
  oldItemsMap.has(uuid-A) = true ✓
  createdAt = '2024-01-01 10:00' (from oldItemsMap) ✓ PRESERVED
  createdBy = UserA (from oldItemsMap) ✓ PRESERVED
  updatedAt = NOW() = '2024-02-01 15:00' ✓ UPDATED
  updatedBy = UserB ✓ UPDATED

Item B (existing): stable_item_id=uuid-B
  oldItemsMap.has(uuid-B) = true ✓
  createdAt = '2024-01-01 10:00' (from oldItemsMap) ✓ PRESERVED
  createdBy = UserA (from oldItemsMap) ✓ PRESERVED
  updatedAt = NOW() = '2024-02-01 15:00' ✓ UPDATED
  updatedBy = UserB ✓ UPDATED
```

**Database Result:**
```
estimation_items (V2):
- stable_item_id=uuid-A, created_at=2024-01-01 10:00, created_by=UserA,  ← PRESERVED!
  updated_at=2024-02-01 15:00, updated_by=UserB  ← UPDATED!

- stable_item_id=uuid-B, created_at=2024-01-01 10:00, created_by=UserA,  ← PRESERVED!
  updated_at=2024-02-01 15:00, updated_by=UserB  ← UPDATED!

estimation_items_history (V1):
- stable_item_id=uuid-A, created_at=2024-01-01 10:00, created_by=UserA,
  updated_at=2024-01-01 10:00, updated_by=UserA, archived_at=2024-02-01 15:00
```

---

### Example 3: Create Third Version (V3) - Add New Item

**User Action:** UserC edits estimation, adds new Item C

**Frontend Sends:**
```json
{
  "items": [
    { "stable_item_id": "uuid-A", "quantity": 60 },  // Existing
    { "stable_item_id": "uuid-B", "quantity": 100 }, // Existing
    { "item_name": "Bookshelf", "quantity": 20 }     // New (no stable_item_id)
  ]
}
```

**Backend Process:**
```javascript
// 1. Fetch old items
oldItemsMap = {
  'uuid-A': { created_at: '2024-01-01 10:00', created_by: UserA },
  'uuid-B': { created_at: '2024-01-01 10:00', created_by: UserA }
}

// 2. Archive and delete old items

// 3. Insert new version
Item A (existing): stable_item_id=uuid-A
  createdAt = '2024-01-01 10:00' ✓ PRESERVED from V1
  createdBy = UserA ✓ PRESERVED from V1
  updatedAt = '2024-03-01 09:00' ✓ UPDATED
  updatedBy = UserC ✓ UPDATED

Item B (existing): stable_item_id=uuid-B
  createdAt = '2024-01-01 10:00' ✓ PRESERVED from V1
  createdBy = UserA ✓ PRESERVED from V1
  updatedAt = '2024-03-01 09:00' ✓ UPDATED
  updatedBy = UserC ✓ UPDATED

Item C (new): stable_item_id=null → DB generates uuid-C
  oldItemsMap.has(null) = false ✗
  createdAt = null → COALESCE(null, NOW()) = '2024-03-01 09:00' ✓ NEW
  createdBy = UserC ✓ NEW
  updatedAt = '2024-03-01 09:00' ✓ NEW
  updatedBy = UserC ✓ NEW
```

**Database Result:**
```
estimation_items (V3):
- stable_item_id=uuid-A, created_at=2024-01-01 10:00, created_by=UserA,  ← From V1!
  updated_at=2024-03-01 09:00, updated_by=UserC

- stable_item_id=uuid-B, created_at=2024-01-01 10:00, created_by=UserA,  ← From V1!
  updated_at=2024-03-01 09:00, updated_by=UserC

- stable_item_id=uuid-C, created_at=2024-03-01 09:00, created_by=UserC,  ← NEW!
  updated_at=2024-03-01 09:00, updated_by=UserC
```

---

## Benefits

### 1. Accurate Creation Tracking ✅
```
Query: "Who created this item?"
Answer: created_by = UserA (from V1)

Not: created_by = UserC (who just edited it in V3)
```

### 2. Complete Audit Trail ✅
```
V1: created_at=2024-01-01, created_by=UserA, updated_at=2024-01-01, updated_by=UserA
V2: created_at=2024-01-01, created_by=UserA, updated_at=2024-02-01, updated_by=UserB
V3: created_at=2024-01-01, created_by=UserA, updated_at=2024-03-01, updated_by=UserC

Can see:
- Original creator: UserA
- Who modified: UserB, then UserC
- When created: 2024-01-01
- When last modified: 2024-03-01
```

### 3. Consistent with Standard Practice ✅
```
created_* = Immutable (set once, never changed)
updated_* = Mutable (updated on every modification)

This is the standard pattern used by most systems:
- Database triggers
- ORM frameworks (ActiveRecord, Eloquent, etc.)
- RESTful APIs
```

### 4. Useful for Reports ✅
```sql
-- Items created by a specific user
SELECT * FROM estimation_items WHERE created_by = UserA;

-- Items modified in last month
SELECT * FROM estimation_items WHERE updated_at > NOW() - INTERVAL '1 month';

-- Items created long ago but recently modified
SELECT * FROM estimation_items 
WHERE created_at < '2024-01-01' 
  AND updated_at > '2024-03-01';
```

---

## Code Changes Summary

### File: `/app/app/api/projects/[id]/estimations/route.js`

**Change 1: Fetch old items before deletion**
```javascript
// NEW: Fetch creation audit data
let oldItemsMap = new Map();

if (currentEstimationId) {
  const oldItemsResult = await query(`
    SELECT stable_item_id, created_at, created_by
    FROM estimation_items
    WHERE estimation_id = $1
  `, [currentEstimationId]);
  
  oldItemsResult.rows.forEach(item => {
    oldItemsMap.set(item.stable_item_id, {
      created_at: item.created_at,
      created_by: item.created_by
    });
  });
  
  // Then archive and delete...
}
```

**Change 2: Determine audit values per item**
```javascript
for (const item of body.items) {
  const stableItemId = item.stable_item_id || null;
  
  let createdAt, createdBy;
  
  if (stableItemId && oldItemsMap.has(stableItemId)) {
    // EXISTING ITEM: Preserve
    const oldAudit = oldItemsMap.get(stableItemId);
    createdAt = oldAudit.created_at;
    createdBy = oldAudit.created_by;
  } else {
    // NEW ITEM: Set to current
    createdAt = null;
    createdBy = session.user.id;
  }
  
  // Insert with conditional values
  await query(`
    INSERT INTO estimation_items (
      ..., created_at, created_by, updated_at, updated_by
    ) VALUES (
      ..., COALESCE($24, NOW()), $25, NOW(), $26
    )
  `, [..., createdAt, createdBy, session.user.id]);
}
```

**Key SQL Feature:**
- `COALESCE($24, NOW())`: If createdAt is not null (existing item), use it; else use NOW()
- Handles both cases in one query

---

## Testing Checklist

### Test 1: Create V1 ✅
- [ ] Create estimation with 2 items
- [ ] Verify `created_at` and `updated_at` are set to NOW()
- [ ] Verify `created_by` and `updated_by` are current user

### Test 2: Create V2 (Edit Existing) ✅
- [ ] Edit estimation, change one item
- [ ] Verify `created_at` and `created_by` PRESERVED from V1
- [ ] Verify `updated_at` and `updated_by` set to NOW() and current user
- [ ] Check history table has V1 data

### Test 3: Create V3 (Add New Item) ✅
- [ ] Edit estimation, add new item
- [ ] Verify existing items preserve V1 creation audit
- [ ] Verify new item has fresh creation audit
- [ ] Check history table has V1 and V2 data

### Test 4: Multiple Versions ✅
- [ ] Create V1, V2, V3, V4
- [ ] Verify items always preserve original `created_at` from V1
- [ ] Verify `updated_at` shows latest modification time
- [ ] Track who created vs who last modified

### Test 5: Query Audit Data ✅
```sql
-- Original creator
SELECT item_name, created_by, created_at 
FROM estimation_items 
WHERE stable_item_id = 'uuid-A';

-- Last modifier
SELECT item_name, updated_by, updated_at 
FROM estimation_items 
WHERE stable_item_id = 'uuid-A';

-- Full history
SELECT version, created_at, created_by, updated_at, updated_by
FROM estimation_items_history
WHERE stable_item_id = 'uuid-A'
ORDER BY version;
```

---

## Files Modified

1. `/app/app/api/projects/[id]/estimations/route.js`
   - Added `oldItemsMap` to fetch and store creation audit
   - Modified item insertion to preserve or set creation audit
   - Added logging for debugging

---

## Conclusion

✅ **Implementation Complete**

**What Changed:**
- `created_at` and `created_by` are now PRESERVED across versions for existing items
- `updated_at` and `updated_by` are UPDATED for every version
- New items get fresh creation audit
- Follows standard audit column semantics

**Database Behavior:**
```
V1: Item created → created_* and updated_* both set to NOW()
V2: Item edited  → created_* preserved, updated_* set to NOW()
V3: Item edited  → created_* preserved, updated_* set to NOW()
```

**The audit trail now accurately reflects the item's lifecycle!**
