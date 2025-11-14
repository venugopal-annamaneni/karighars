# Purchase Request Edit Feature - Bug Fix Summary

## Problem Identified

The "Edit PR" feature had a critical bug where `purchase_request_estimation_links` were not being properly handled during the versioning/edit process. This meant that when users edited PRs, the crucial links between PR items and estimation items were lost.

## Root Cause

The backend versioning logic in `lib/versioning-utils.js` was incomplete:
- It only copied existing links to history and updated their version numbers
- It did NOT handle creation, deletion, or modification of links based on user edits
- The frontend was sending the correct data (items with their `estimation_links`), but the backend wasn't processing it

## Solution Implemented

### Backend Changes (`lib/versioning-utils.js`)

#### 1. Enhanced `createNewPRVersion` Function

**Previous Behavior:**
- Fetched items without their links
- Re-inserted items but ignored link updates from the payload
- Called a separate `versionEstimationLinks()` that just copied existing links

**New Behavior:**
- Fetches items WITH their current estimation_links using a JOIN query
- Creates a complete map of updated items including their new `estimation_links` arrays
- Moves old links to history before deleting them
- Re-inserts each item AND its links in the same loop
- Properly handles three scenarios:
  - **Updated links**: Uses the new links from the payload
  - **Unchanged links**: Uses existing links from the database
  - **No links**: Handles direct purchase items correctly

**Key Changes:**
```javascript
// Now fetches items with links
const currentItemsResult = await query(`
  SELECT 
    pri.*,
    COALESCE(
      json_agg(json_build_object(...)) FILTER (WHERE prel.id IS NOT NULL),
      '[]'
    ) as estimation_links
  FROM purchase_request_items pri
  LEFT JOIN purchase_request_estimation_links prel 
    ON pri.stable_item_id = prel.stable_item_id
  WHERE pri.purchase_request_id = $1
  GROUP BY pri.id, ...
`, [prId]);

// Moves links to history BEFORE deletion
await moveLinksToHistory(prId, userId);

// Deletes old links
await query(`DELETE FROM purchase_request_estimation_links WHERE ...`);

// Re-inserts items and returns new purchase_request_item.id
const insertResult = await query(`INSERT INTO purchase_request_items ... RETURNING id`);
const newPurchaseRequestItemId = insertResult.rows[0].id;

// Determines which links to insert (updated or existing)
let linksToInsert = [];
if (updates && updates.estimation_links !== undefined) {
  linksToInsert = updates.estimation_links || [];
} else {
  linksToInsert = item.estimation_links || [];
}

// Inserts each link with new version
for (const link of linksToInsert) {
  await query(`INSERT INTO purchase_request_estimation_links ...`);
}
```

#### 2. New Helper Function: `moveLinksToHistory`

Replaced the old `versionEstimationLinks` function with a simpler one that:
- Checks if links exist for the PR
- Moves them to `purchase_request_estimation_links_history`
- Does NOT update version (since links will be deleted and re-inserted)

### Frontend Status (`app/projects/[id]/purchase-requests/[prId]/edit/page.js`)

**No changes required!** The frontend was already correctly implemented:
- Groups items by fulfillment type (Full Unit, Component, Direct)
- Manages estimation_links in state
- Sends complete item data with `estimation_links` array in the payload
- Handles weightage editing for component-wise items

## Data Flow (After Fix)

1. **User edits an item** on the Edit PR page
   - Changes quantity, price, or weightage for a component
   
2. **Frontend sends payload** to PUT `/api/projects/[id]/purchase-requests/[prId]/edit`:
   ```json
   {
     "items": [
       {
         "stable_item_id": "uuid-here",
         "purchase_request_item_name": "Plywood 18mm",
         "quantity": 60,
         "unit_price": 1500,
         "estimation_links": [
           {
             "estimation_item_id": 123,
             "linked_qty": 100,
             "weightage": 0.6,
             "notes": "Updated weightage"
           }
         ]
       }
     ]
   }
   ```

3. **Backend processes the edit** (`edit/route.js`):
   - Validates user permissions
   - Checks lifecycle_status (only 'pending' items can be edited)
   - Calls `createNewPRVersion(prId, itemsToEdit, userId, changeSummary)`

4. **Versioning logic** (`versioning-utils.js`):
   - Moves current items to `purchase_request_items_history`
   - Moves current links to `purchase_request_estimation_links_history`
   - Deletes current items and links
   - Re-inserts items with new version number
   - **Re-inserts links with updated values from the payload**
   - Recalculates PR totals
   - Creates version record

5. **Result**:
   - All items and links are at the new version
   - Old versions are preserved in history tables
   - Estimation links are updated with new weightages/quantities
   - Data integrity is maintained

## Testing Recommendations

### Scenario 1: Edit Full Unit Item
1. Create a PR with full unit items (weightage = 1.0)
2. Edit the quantity and unit price
3. Verify the item updates correctly
4. Verify the estimation_link is preserved

### Scenario 2: Edit Component Weightage
1. Create a PR with component breakdown
2. Edit the weightage of a component (e.g., from 50% to 60%)
3. Verify the weightage updates in the database
4. Verify the link's `unit_purchase_request_item_weightage` is updated

### Scenario 3: Edit Multiple Items
1. Create a PR with mixed items (full unit, component, direct)
2. Edit items from each category
3. Verify all changes are saved correctly
4. Verify all links are maintained/updated

### Scenario 4: Version History
1. Edit a PR multiple times
2. Check `purchase_request_versions` table for version records
3. Check history tables for old data
4. Verify version numbers increment correctly

## Database Impact

### Tables Modified During Edit:
- `purchase_request_items`: Deleted and re-inserted with new version
- `purchase_request_estimation_links`: Deleted and re-inserted with new version
- `purchase_request_items_history`: Old items archived
- `purchase_request_estimation_links_history`: Old links archived
- `purchase_request_versions`: New version record created
- `purchase_requests`: Totals recalculated and updated

### Columns Used for Versioning:
- `stable_item_id` (UUID): Links an item across versions
- `version` (INTEGER): Version number for the item/link
- `archived_at`: Timestamp when moved to history

## Known Limitations

1. **Performance**: Each edit creates a full new version of ALL items, even if only one changed. This is by design for complete audit trail but could be optimized.

2. **Concurrent Edits**: No locking mechanism yet. If two users edit simultaneously, last write wins.

3. **Link Validation**: The system doesn't currently validate that total weightage = 100% for component items.

4. **Direct Purchase Items**: Can be edited but have no links to manage (working as intended).

## Next Steps

After this fix, the following features can be built:
1. **Version History UI**: Show users a timeline of PR changes
2. **Version Comparison**: Compare two versions side-by-side
3. **Link Validation**: Add warnings when component weightages don't sum to 100%
4. **Lifecycle Transitions**: Allow changing item status from pending → sent_to_vendor
5. **Vendor Communication**: PDF generation and email sending

## Files Modified

- `/app/lib/versioning-utils.js` - Enhanced versioning logic with link management
  - Modified: `createNewPRVersion()` function
  - Renamed: `versionEstimationLinks()` → `moveLinksToHistory()`

No other files were modified. The fix was purely in the backend versioning logic.
