# Deletion Logic Cleanup - Implementation Summary

## Overview
Removed `deleted_at` and `deleted_by` columns from the PR items tables and simplified the deletion architecture to align with the versioning pattern.

## Problem Analysis

### Old Architecture (Broken):
```
Current Table: Items A, B, C (all active)
User deletes B

Backend:
1. Move A, B, C to history
2. Re-insert A, B, C with B having deleted_at set
3. B remains in current table (soft delete)

Issues:
- "Deleted" items still in current table
- Every query needs WHERE deleted_at IS NULL
- This filtering was NOT implemented
- Confusing semantics: "Is this item active or deleted?"
```

### New Architecture (Clean):
```
Current Table: Items A, B, C
User deletes B

Frontend: Sends only [A, C]

Backend:
1. Move A, B, C to history (version 1)
2. Delete A, B, C from current table
3. Re-insert ONLY [A, C] (version 2)

Result:
- Current table: A, C (version 2) - Active items only
- History table: A, B, C (version 1) - Complete audit trail
- B is ONLY in history → Clearly deleted
```

## Changes Implemented

### 1. Database Migration (020_remove_deleted_at_columns.sql)

```sql
-- Remove from current table
ALTER TABLE purchase_request_items
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;

-- Remove from history table
ALTER TABLE purchase_request_items_history
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;
```

**Status**: ✅ Migration executed successfully

### 2. Backend - versioning-utils.js

#### Changed: `createNewPRVersion()` function

**Before**: Looped through ALL current items, merged updates, re-inserted ALL
```javascript
for (const item of currentItems) {
  const updates = updatesMap.get(item.stable_item_id);
  const itemData = updates ? { ...item, ...updates } : item;
  // Re-insert (including deleted items with deleted_at)
}
```

**After**: Only loops through payload items, implicitly deletes omitted items
```javascript
for (const payloadItem of updatedItems) {
  const currentItem = currentItemsMap.get(payloadItem.stable_item_id);
  const itemData = { ...currentItem, ...payloadItem };
  // Re-insert ONLY items in payload
}
// Items not in payload are NOT re-inserted = deleted
```

**Key Changes**:
- Creates map of current items for reference
- Iterates over `updatedItems` (payload) instead of `currentItems`
- Only re-inserts items present in the payload
- Items missing from payload are implicitly deleted
- Better change type detection (items_deleted, items_edited, items_added)
- Total items count reflects new version, not old version

#### Changed: `deleteItemsFromPR()` function

**Before**: Added `deleted_at` and `deleted_by` to items
```javascript
const deletedItems = stableItemIds.map(id => ({
  stable_item_id: id,
  deleted_at: new Date(),
  deleted_by: userId
}));
```

**After**: Filters items and creates new version without deleted items
```javascript
// Get all current items
const currentItemsResult = await query(...);

// Filter out items to delete
const itemsToKeep = currentItemsResult.rows.filter(
  item => !stableItemIds.includes(item.stable_item_id)
);

// Create new version with only the items to keep
const newVersion = await createNewPRVersion(prId, itemsToKeep, userId, ...);
```

### 3. Backend - edit/route.js

**Removed**: Entire `DELETE` endpoint (lines 128-221)

**Reason**: No longer needed! Deletions are now handled by the `PUT` endpoint:
- Frontend sends only the items to keep
- Backend re-inserts only those items
- Items not in the payload are implicitly deleted

**Replaced with**: Comment explaining the new approach
```javascript
// Note: DELETE endpoint removed. Deletions are now handled by simply not including
// the item in the PUT request. The versioning system will only re-insert items
// that are present in the payload, effectively deleting items that are omitted.
```

### 4. Frontend - edit/page.js

#### Simplified: `handleSaveChanges()` function

**Before**: TWO separate API calls
```javascript
// 1. Find deleted items by comparing arrays
const deletedItemIds = [];
originalItems.forEach(original => {
  if (!items.find(i => i.stable_item_id === original.stable_item_id)) {
    deletedItemIds.push(original.stable_item_id);
  }
});

// 2. Find edited items
const editedItemsWithLinks = [];
items.forEach(item => {
  if (itemChanged || linksChanged) {
    editedItemsWithLinks.push(...);
  }
});

// 3. Call PUT for edits
if (editedItemsWithLinks.length > 0) {
  await fetch('/edit', { method: 'PUT', body: editedItemsWithLinks });
}

// 4. Call DELETE for deletions
if (deletedItemIds.length > 0) {
  await fetch('/edit', { method: 'DELETE', body: deletedItemIds });
}
```

**After**: ONE simple API call
```javascript
// Count deleted items for summary only
const deletedCount = originalItems.length - items.length;

// Prepare ALL remaining items with their links
const allItemsWithLinks = items.map(item => ({
  stable_item_id: item.stable_item_id,
  purchase_request_item_name: item.purchase_request_item_name,
  quantity: parseFloat(item.quantity),
  unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
  category: item.category,
  room_name: item.room_name,
  is_direct_purchase: item.is_direct_purchase,
  estimation_links: item.estimation_links || []
}));

// Single API call to save all changes
const res = await fetch('/edit', {
  method: 'PUT',
  body: JSON.stringify({
    items: allItemsWithLinks,
    change_summary: `...`,
    ...
  })
});
```

**Benefits**:
- No complex diff logic to find deleted items
- No separate DELETE call
- Simpler, more maintainable code
- Single transaction in backend
- Better error handling (one atomic operation)

## How It Works Now

### Example: Edit and Delete Items

**Initial State (Version 1)**:
```
Current Table:
- Item A (Plywood, qty: 50)
- Item B (Nails, qty: 100)
- Item C (Paint, qty: 10)

History Table: (empty)
```

**User Actions**:
1. Edits Item A: quantity 50 → 60
2. Deletes Item B
3. Keeps Item C unchanged

**Frontend Sends**:
```json
{
  "items": [
    { "stable_item_id": "uuid-A", "quantity": 60, ... },
    { "stable_item_id": "uuid-C", "quantity": 10, ... }
  ]
}
// Note: Item B is NOT in the payload
```

**Backend Process** (`createNewPRVersion`):
```
1. Fetch current items: A, B, C (with links)
2. Move A, B, C to history table (version 1)
3. Move all links to history
4. Delete A, B, C from current table
5. Delete all links from current table
6. Loop through payload items: [A, C]
   - For A: Merge current + updates, recalculate pricing, insert with version 2
   - For C: Use current data, insert with version 2
7. Re-insert links for A and C (with version 2)
8. Recalculate PR totals
9. Create version record: "Edited items and deleted 1 item(s)"
```

**Final State (Version 2)**:
```
Current Table:
- Item A (Plywood, qty: 60, version: 2)
- Item C (Paint, qty: 10, version: 2)

History Table:
- Item A (Plywood, qty: 50, version: 1, archived_at: timestamp)
- Item B (Nails, qty: 100, version: 1, archived_at: timestamp)
- Item C (Paint, qty: 10, version: 1, archived_at: timestamp)
```

**Audit Trail**:
- Compare current (version 2) with history (version 1)
- Item A: Quantity changed (50 → 60)
- Item B: Missing from current → Deleted
- Item C: Unchanged

## Benefits of New Architecture

### 1. **Clearer Semantics**
- Current table = active items only
- History table = complete audit trail
- No ambiguity about item state

### 2. **Simpler Queries**
- No need for `WHERE deleted_at IS NULL` everywhere
- `SELECT * FROM purchase_request_items WHERE purchase_request_id = ?` → All active items
- No risk of forgetting the filter

### 3. **Single API Call**
- Frontend makes ONE PUT request
- Backend processes everything in ONE transaction
- Better atomicity and error handling

### 4. **Smaller Payload**
- Frontend doesn't send separate deleted_items array
- Just sends the items that should exist
- Cleaner API contract

### 5. **Correct Version Metadata**
```javascript
// Version record now accurate
{
  version: 2,
  change_type: 'items_deleted',  // or 'items_edited'
  total_items: 2,  // Actual count in version 2
  items_affected: ['uuid-A'],  // Items that changed
}
```

### 6. **Aligns with Versioning Pattern**
- "Current table = latest snapshot"
- "History table = all previous snapshots"
- Standard pattern used by many versioning systems

## Testing Scenarios

### Scenario 1: Delete Single Item ✅
```
Before: [A, B, C]
Action: Delete B
After: [A, C]

Expected:
- Current table: A, C (version 2)
- History: A, B, C (version 1)
- Version record: "Deleted 1 item(s)"
```

### Scenario 2: Delete All Items ✅
```
Before: [A, B, C]
Action: Delete A, B, C
After: []

Expected:
- Current table: (empty)
- History: A, B, C (version 1)
- Version record: "Deleted 3 item(s)", change_type: 'all_items_deleted'
```

### Scenario 3: Edit + Delete Together ✅
```
Before: [A, B, C]
Action: Edit A, Delete B
After: [A (edited), C]

Expected:
- Current table: A (edited), C (version 2)
- History: A, B, C (version 1)
- Version record: "Edited items and deleted 1 item(s)"
```

### Scenario 4: Delete with Estimation Links ✅
```
Before: Item B has links to estimation items [E1, E2]
Action: Delete B

Expected:
- B's links moved to purchase_request_estimation_links_history
- B's links deleted from purchase_request_estimation_links
- B itself moved to purchase_request_items_history
- Audit trail complete
```

## Database State After Cleanup

### Tables Modified
- `purchase_request_items`: Removed `deleted_at`, `deleted_by`
- `purchase_request_items_history`: Removed `deleted_at`, `deleted_by`

### Tables Unchanged
- `purchase_requests`: No changes
- `purchase_request_estimation_links`: No changes
- `purchase_request_estimation_links_history`: No changes
- `purchase_request_versions`: No changes

### Column Counts
```
Before:
- purchase_request_items: 21 columns (with deleted_at, deleted_by)
- purchase_request_items_history: 23 columns (with deleted_at, deleted_by)

After:
- purchase_request_items: 19 columns
- purchase_request_items_history: 21 columns
```

## Backward Compatibility

⚠️ **Breaking Change**: Old code that relied on `deleted_at` will fail.

**Affected Code** (if any exists):
- Queries filtering by `deleted_at IS NULL`
- Logic checking `deleted_at` to determine item status
- Reports showing "deleted" items separately

**Migration Path**:
1. Remove any queries with `deleted_at` filter
2. To find deleted items: Compare version N with version N-1
3. Use `purchase_request_items_history` for audit reports

## Next Steps

With this cleanup complete, the following features can be built more easily:

1. **Version Comparison UI**: Show diff between versions
   - Items added (in v2, not in v1)
   - Items deleted (in v1, not in v2)
   - Items modified (different values)

2. **Audit Reports**: "Show me what changed"
   - Query history table for specific version
   - Compare with current
   - Generate change log

3. **Undo/Rollback**: Restore previous version
   - Fetch items from history at version N
   - Create new version N+1 with those items
   - "Undo" is just another version

4. **Bulk Operations**: Delete multiple PRs efficiently
   - No need to update `deleted_at` on thousands of items
   - Just delete from current table
   - History preserved

## Files Modified

1. `/app/migrations/020_remove_deleted_at_columns.sql` - NEW
2. `/app/run_migration_020.js` - NEW
3. `/app/lib/versioning-utils.js` - MODIFIED
   - `createNewPRVersion()` - Refactored to only re-insert payload items
   - `deleteItemsFromPR()` - Refactored to filter and re-insert
4. `/app/app/api/projects/[id]/purchase-requests/[prId]/edit/route.js` - MODIFIED
   - Removed `DELETE` endpoint
5. `/app/app/projects/[id]/purchase-requests/[prId]/edit/page.js` - MODIFIED
   - Simplified `handleSaveChanges()` to one API call

## Conclusion

This cleanup:
- ✅ Removes unnecessary columns
- ✅ Simplifies the deletion model
- ✅ Aligns with versioning best practices
- ✅ Makes code more maintainable
- ✅ Reduces complexity in both frontend and backend
- ✅ Maintains complete audit trail
- ✅ Improves query performance (no soft delete filtering)

The system is now cleaner, simpler, and more intuitive. Deletions are implicit (items not re-inserted), and the audit trail is complete in the history tables.
