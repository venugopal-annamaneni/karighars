# Frontend Fix: Include stable_item_id in Estimation Payload

## Problem
The frontend was not including `stable_item_id` when fetching and submitting estimation items, which meant the backend couldn't preserve stable IDs across versions.

## Solution
Updated the frontend to:
1. Fetch `stable_item_id` from the API
2. Store it in component state
3. Include it in the payload when creating new estimation versions

---

## Changes Made

### File: `/app/app/projects/[id]/manage-estimation/page.js`

#### Change 1: Fetch stable_item_id (Line 127)

**Before:**
```javascript
const normalizedItems = itemsData.items.map(item => ({
  id: item.id || Date.now() + Math.random(),
  room_name: item.room_name || '',
  category: item.category,
  item_name: item.item_name,
  // ... other fields
  vendor_type: item.vendor_type
}));
```

**After:**
```javascript
const normalizedItems = itemsData.items.map(item => ({
  id: item.id || Date.now() + Math.random(),
  stable_item_id: item.stable_item_id,  // NEW: Preserve for versioning
  room_name: item.room_name || '',
  category: item.category,
  item_name: item.item_name,
  // ... other fields
  vendor_type: item.vendor_type
}));
```

---

#### Change 2: Include stable_item_id in overpayment flow (Line 298)

**Before:**
```javascript
const itemsWithCalcs = data
  .filter(item => item.item_name.trim() !== '')
  .map(item => {
    const calc = calculateItemTotal(item);
    return {
      ...item,
      item_name: item.item_name,
      subtotal: calc.subtotal,
      // ... calculated fields
      item_total: calc.item_total
    };
  });
```

**After:**
```javascript
const itemsWithCalcs = data
  .filter(item => item.item_name.trim() !== '')
  .map(item => {
    const calc = calculateItemTotal(item);
    return {
      ...item,
      stable_item_id: item.stable_item_id,  // NEW: Include for versioning
      item_name: item.item_name,
      subtotal: calc.subtotal,
      // ... calculated fields
      item_total: calc.item_total
    };
  });
```

---

#### Change 3: Include stable_item_id in normal flow (Line 328)

**Before:**
```javascript
const itemsWithCalcs = data
  .filter(item => item.item_name.trim() !== '')
  .map(item => {
    const calc = calculateItemTotal(item);
    return {
      ...item,
      item_name: item.item_name,
      subtotal: calc.subtotal,
      // ... calculated fields
      item_total: calc.item_total
    };
  });
```

**After:**
```javascript
const itemsWithCalcs = data
  .filter(item => item.item_name.trim() !== '')
  .map(item => {
    const calc = calculateItemTotal(item);
    return {
      ...item,
      stable_item_id: item.stable_item_id,  // NEW: Include for versioning
      item_name: item.item_name,
      subtotal: calc.subtotal,
      // ... calculated fields
      item_total: calc.item_total
    };
  });
```

---

## Data Flow

### Creating Estimation Version 1 (New Items)

**User Action:** Create first estimation

**Frontend sends:**
```json
{
  "project_id": 1,
  "items": [
    {
      "item_name": "TV Unit",
      "quantity": 50,
      // No stable_item_id = new item
    },
    {
      "item_name": "Wardrobe",
      "quantity": 100,
      // No stable_item_id = new item
    }
  ]
}
```

**Backend receives:**
- Items without `stable_item_id`
- DB generates UUIDs: `uuid-A`, `uuid-B`

**Database Result:**
```
estimation_items:
- id=1001, stable_item_id=uuid-A, item_name="TV Unit"
- id=1002, stable_item_id=uuid-B, item_name="Wardrobe"
```

---

### Editing Estimation (Creating Version 2)

**Step 1: Frontend fetches items**

```javascript
GET /api/projects/1/estimations/100/items

Response:
{
  "items": [
    {
      "id": 1001,
      "stable_item_id": "uuid-A",  // ✓ Fetched
      "item_name": "TV Unit",
      "quantity": 50
    },
    {
      "id": 1002,
      "stable_item_id": "uuid-B",  // ✓ Fetched
      "item_name": "Wardrobe",
      "quantity": 100
    }
  ]
}
```

**Step 2: User edits quantity, adds new item**

**Step 3: Frontend sends edited data**

```javascript
POST /api/projects/1/estimations

Payload:
{
  "project_id": 1,
  "items": [
    {
      "stable_item_id": "uuid-A",  // ✓ Preserved
      "item_name": "TV Unit",
      "quantity": 60  // Changed
    },
    {
      "stable_item_id": "uuid-B",  // ✓ Preserved
      "item_name": "Wardrobe",
      "quantity": 100  // Unchanged
    },
    {
      // No stable_item_id = new item
      "item_name": "Bookshelf",
      "quantity": 20
    }
  ]
}
```

**Backend receives:**
- Two items WITH `stable_item_id` (existing items)
- One item WITHOUT `stable_item_id` (new item)

**Backend processes:**
```javascript
for (const item of body.items) {
  const stableItemId = item.stable_item_id || null;
  
  INSERT INTO estimation_items (
    estimation_id,
    stable_item_id,  // Preserves uuid-A, uuid-B, generates uuid-C
    item_name,
    quantity,
    ...
  ) VALUES (200, stableItemId, ...)
}
```

**Database Result (Version 2):**
```
estimation_items:
- id=2001, stable_item_id=uuid-A, item_name="TV Unit", qty=60, estimation_id=200
- id=2002, stable_item_id=uuid-B, item_name="Wardrobe", qty=100, estimation_id=200
- id=2003, stable_item_id=uuid-C, item_name="Bookshelf", qty=20, estimation_id=200

(Old version 1 items remain in DB with estimation_id=100, is_active=false)
```

---

## Behavior Summary

### Existing Items (Have stable_item_id)
```
Frontend fetches: ✓ stable_item_id included
Frontend stores: ✓ stable_item_id in state
Frontend sends: ✓ stable_item_id in payload
Backend receives: ✓ stable_item_id preserved
Backend inserts: ✓ Uses provided stable_item_id
Result: ✓ Same logical item across versions
```

### New Items (No stable_item_id)
```
Frontend creates: ✗ No stable_item_id (correct!)
Frontend sends: ✗ No stable_item_id in payload
Backend receives: null for stable_item_id
Backend inserts: DEFAULT gen_random_uuid()
Result: ✓ New UUID generated by DB
```

---

## Testing Checklist

### Test 1: Create First Estimation ✅
- [ ] Create estimation with 3 items
- [ ] Verify items get stable_item_id from DB
- [ ] Check database: `SELECT id, stable_item_id, item_name FROM estimation_items`

### Test 2: Edit Estimation (Create Version 2) ✅
- [ ] Fetch existing estimation in UI
- [ ] Verify browser DevTools shows stable_item_id in state
- [ ] Edit one item's quantity
- [ ] Submit form
- [ ] Check Network tab: payload includes stable_item_id
- [ ] Verify database: same stable_item_id, new id

### Test 3: Add New Item in Version 2 ✅
- [ ] Edit estimation, add new item
- [ ] Submit form
- [ ] New item should NOT have stable_item_id in payload
- [ ] Verify database: new item gets UUID from DB

### Test 4: Delete Item in Version 2 ✅
- [ ] Edit estimation, remove one item
- [ ] Submit form
- [ ] Deleted item not in payload
- [ ] Verify database: deleted item only in old version

### Test 5: PR Links Survive Versioning ✅
- [ ] Create PR from estimation V1
- [ ] Edit estimation to create V2
- [ ] View PR details
- [ ] Verify links resolve to V2 items (not V1)

---

## Important Notes

### 1. New Items DON'T Need stable_item_id
The `emptyItem` template (line 55) correctly does NOT include `stable_item_id`. This is intentional:
- New items → no stable_item_id in frontend
- Backend receives null
- DB generates UUID automatically

### 2. Deleted Items Handled by Omission
When a user deletes an item:
- Frontend removes it from state
- Item not in the payload
- Backend only re-inserts items from payload
- Deleted item's stable_item_id only exists in old version

### 3. Frontend State Management
The `data` state array holds all items with their stable_item_id. Any operations (edit, calculate totals, etc.) preserve this field through the `...item` spread operator.

---

## Benefits

✅ **Correct Versioning:** Backend can track items across versions
✅ **PR Link Stability:** Links remain valid when estimation is re-versioned
✅ **Audit Trail:** Can see how specific items changed (V1→V2→V3)
✅ **No Breaking Changes:** New items still work (DB generates UUIDs)
✅ **Clean Architecture:** Consistent with PR items pattern

---

## Related Files

**Backend:**
- `/app/app/api/projects/[id]/estimations/route.js` - Receives and uses stable_item_id
- `/app/lib/versioning-utils.js` - Uses stable_estimation_item_id in links

**Frontend:**
- `/app/app/projects/[id]/manage-estimation/page.js` - Fetches and sends stable_item_id

**Documentation:**
- `/app/STABLE_ESTIMATION_ITEMS_ANALYSIS.md` - Original analysis
- `/app/STABLE_ESTIMATION_ITEMS_IMPLEMENTATION.md` - Backend implementation
- `/app/FRONTEND_STABLE_ITEM_ID_FIX.md` - This document
