# CSV Upload Edit Flow - Analysis & Approach

## Current Problem

**CSV Upload Flow (WRONG):**
```javascript
// Check if estimation exists
if (exists) {
  return error("Estimation already exists");  ❌
}

// Create new estimation
INSERT INTO project_estimations...
INSERT INTO estimation_items...
```

**Issues:**
1. Can't update estimation via CSV (rejects if exists)
2. No stable_item_id in CSV template
3. Forces users to delete estimation first
4. Loses item history

---

## Desired Behavior (CORRECT)

**CSV Upload Should Work Like UI Edit:**

### If Estimation DOES NOT Exist (First Time):
```javascript
// Create new estimation (like POST)
INSERT INTO project_estimations...
INSERT INTO estimation_items... (all items are new)
```

### If Estimation EXISTS (Edit):
```javascript
// Update existing estimation (like PUT)
1. Get max version from history
2. Archive current items to history (version++)
3. Delete current items
4. Insert items from CSV:
   - Items WITH stable_item_id → preserve created_at/created_by
   - Items WITHOUT stable_item_id → new created_at/created_by
5. Update estimation totals
```

**Result:** CSV workflow = UI workflow (consistent!)

---

## Implementation Plan

### Phase 1: Update CSV Template Download

**File:** `/app/app/api/projects/[id]/estimations/template/route.js`

**Current CSV Columns:**
```
Category, Room Name, Vendor Type, Item Name, Unit, Width, Height, Quantity, 
Unit Price, Subtotal, KG Charges %, KG Charges Amount, Item Discount %, 
Item Discount Amount, Discount KG Charges %, Discount KG Charges Amount, 
GST %, GST Amount, Amount Before GST, Item Total, Status
```

**Add Column:**
```
stable_item_id (FIRST COLUMN)
```

**CSV Template Should Show:**
```csv
stable_item_id,Category,Room Name,Vendor Type,Item Name,...
uuid-A,Furniture,Living Room,Type A,TV Unit,...          # Existing item
uuid-B,Furniture,Bedroom,Type A,Wardrobe,...             # Existing item
,Furniture,Kitchen,Type B,Cabinet,...                     # New item (empty stable_item_id)
```

**Code Changes:**
```javascript
// Add stable_item_id to SELECT
const estimationItemsRes = await query(`
  SELECT 
    ei.stable_item_id,  // NEW: Add this
    ei.category,
    ei.room_name,
    ei.vendor_type,
    ei.item_name,
    // ... all other columns
  FROM estimation_items ei
  INNER JOIN project_estimations pe ON ei.estimation_id = pe.id
  WHERE pe.project_id = $1
  ORDER BY ei.category, ei.room_name, ei.item_name
`, [projectId]);

// Include in CSV headers
const headers = [
  'stable_item_id',  // NEW: First column
  'Category',
  'Room Name',
  // ... rest
];

// Map data with stable_item_id
const dataRows = estimationItemsRes.rows.map(item => [
  item.stable_item_id || '',  // NEW: Include stable_item_id (empty for sample rows)
  item.category,
  item.room_name,
  // ... rest
]);
```

---

### Phase 2: Update CSV Upload Logic

**File:** `/app/app/api/projects/[id]/estimations/upload/route.js`

**New Flow:**

```javascript
export async function POST(request, { params }) {
  const { projectId } = params;
  const formData = await request.formData();
  const csvFile = formData.get('file');
  
  try {
    await query('BEGIN');
    
    // Parse CSV
    const csvContent = await csvFile.text();
    const parsedData = parse(csvContent, { columns: true });
    
    // Process items and extract stable_item_id
    const calculatedItems = parsedData.map(row => ({
      stable_item_id: row.stable_item_id || null,  // NEW: Parse from CSV
      category: row['Category'],
      room_name: row['Room Name'],
      // ... parse all fields
    }));
    
    // Calculate totals
    const totals = calculateCategoryTotals(calculatedItems, baseRates);
    
    // Check if estimation exists
    const existingEstimation = await query(`
      SELECT id FROM project_estimations WHERE project_id = $1
    `, [projectId]);
    
    if (existingEstimation.rows.length === 0) {
      // ===== SCENARIO 1: CREATE NEW ESTIMATION =====
      console.log('Creating new estimation from CSV');
      
      // Create estimation
      const estimationRes = await query(`
        INSERT INTO project_estimations (
          project_id, source, csv_file_path, created_by,
          category_breakdown, items_value, kg_charges, 
          items_discount, kg_discount, discount, gst_amount, final_value,
          has_overpayment, overpayment_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `, [
        projectId, 'csv_upload', filePath, userId,
        JSON.stringify(totals.category_breakdown),
        totals.items_value, totals.kg_charges,
        totals.items_discount, totals.kg_discount, totals.discount, 
        totals.gst_amount, totals.final_value,
        hasOverpayment, overpaymentAmount
      ]);
      
      const estimationId = estimationRes.rows[0].id;
      
      // Insert items (all new, no stable_item_id needed)
      for (const item of calculatedItems) {
        await query(`
          INSERT INTO estimation_items (
            estimation_id, stable_item_id, category, room_name, ...,
            created_at, created_by, updated_at, updated_by
          ) VALUES ($1, $2, $3, $4, ..., NOW(), $5, NOW(), $5)
        `, [
          estimationId,
          null,  // All items are new, DB generates UUID
          item.category,
          item.room_name,
          // ... all fields
          userId
        ]);
      }
      
    } else {
      // ===== SCENARIO 2: UPDATE EXISTING ESTIMATION =====
      console.log('Updating existing estimation from CSV');
      
      const estimationId = existingEstimation.rows[0].id;
      
      // Get current max version from history
      const versionResult = await query(`
        SELECT COALESCE(MAX(version), 0) as max_version
        FROM estimation_items_history
        WHERE estimation_id = $1
      `, [estimationId]);
      
      const nextVersion = versionResult.rows[0].max_version + 1;
      
      // Fetch old items (for preserving created_at/created_by)
      const oldItemsResult = await query(`
        SELECT stable_item_id, created_at, created_by
        FROM estimation_items
        WHERE estimation_id = $1
      `, [estimationId]);
      
      let oldItemsMap = new Map();
      oldItemsResult.rows.forEach(item => {
        oldItemsMap.set(item.stable_item_id, {
          created_at: item.created_at,
          created_by: item.created_by
        });
      });
      
      // Archive current items to history
      await query(`
        INSERT INTO estimation_items_history (
          id, stable_item_id, estimation_id, category, room_name, ...,
          created_at, created_by, updated_at, updated_by,
          version, archived_at, archived_by
        )
        SELECT 
          id, stable_item_id, estimation_id, category, room_name, ...,
          created_at, created_by, updated_at, updated_by,
          $2, NOW(), $3
        FROM estimation_items
        WHERE estimation_id = $1
      `, [estimationId, nextVersion, userId]);
      
      // Delete current items
      await query(`
        DELETE FROM estimation_items WHERE estimation_id = $1
      `, [estimationId]);
      
      // Insert items from CSV
      for (const item of calculatedItems) {
        const stableItemId = item.stable_item_id || null;
        
        // Determine creation audit
        let createdAt, createdBy;
        
        if (stableItemId && oldItemsMap.has(stableItemId)) {
          // EXISTING ITEM: Preserve creation audit
          const oldAudit = oldItemsMap.get(stableItemId);
          createdAt = oldAudit.created_at;
          createdBy = oldAudit.created_by;
        } else {
          // NEW ITEM: Fresh creation audit
          createdAt = null;
          createdBy = userId;
        }
        
        await query(`
          INSERT INTO estimation_items (
            estimation_id, stable_item_id, category, room_name, ...,
            created_at, created_by, updated_at, updated_by
          ) VALUES (
            $1, COALESCE($2, gen_random_uuid()), $3, $4, ...,
            COALESCE($5, NOW()), $6, NOW(), $7
          )
        `, [
          estimationId,
          stableItemId,
          item.category,
          item.room_name,
          // ... all fields
          createdAt,
          createdBy,
          userId
        ]);
      }
      
      // Update estimation totals
      await query(`
        UPDATE project_estimations
        SET 
          category_breakdown = $2,
          items_value = $3,
          kg_charges = $4,
          items_discount = $5,
          kg_discount = $6,
          discount = $7,
          gst_amount = $8,
          final_value = $9,
          has_overpayment = $10,
          overpayment_amount = $11,
          csv_file_path = $12,
          updated_at = NOW(),
          updated_by = $13
        WHERE id = $1
      `, [
        estimationId,
        JSON.stringify(totals.category_breakdown),
        totals.items_value, totals.kg_charges,
        totals.items_discount, totals.kg_discount, totals.discount,
        totals.gst_amount, totals.final_value,
        hasOverpayment, overpaymentAmount,
        filePath,
        userId
      ]);
    }
    
    await query('COMMIT');
    
    return NextResponse.json({
      success: true,
      estimation_id: estimationId,
      items_count: calculatedItems.length,
      final_value: totals.final_value,
      version: nextVersion || 1,
      action: existingEstimation.rows.length === 0 ? 'created' : 'updated'
    });
    
  } catch (error) {
    await query('ROLLBACK');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## User Workflow Examples

### Example 1: First Time Upload (No Estimation)

**User Actions:**
1. Download template → Gets blank CSV with sample rows
2. Fill in items (stable_item_id column is empty)
3. Upload CSV

**Backend:**
```
Check estimation: NOT EXISTS
Action: CREATE
- Insert estimation
- Insert items (all stable_item_id = NULL → DB generates)

Result:
estimation_items:
- id=1, stable_item_id=uuid-A, item_name='TV Unit'
- id=2, stable_item_id=uuid-B, item_name='Wardrobe'
```

---

### Example 2: Update Existing (Download → Edit → Upload)

**User Actions:**
1. Download template → Gets CSV with existing items + stable_item_id
2. Edit CSV:
   - Keep row 1 with stable_item_id=uuid-A (edit quantity)
   - Keep row 2 with stable_item_id=uuid-B (unchanged)
   - Add row 3 with empty stable_item_id (new item)
3. Upload CSV

**CSV Content:**
```csv
stable_item_id,Category,Room Name,Item Name,Quantity,...
uuid-A,Furniture,Living Room,TV Unit,60,...           # Existing, edited
uuid-B,Furniture,Bedroom,Wardrobe,100,...             # Existing, unchanged
,Furniture,Kitchen,Cabinet,20,...                      # New item
```

**Backend:**
```
Check estimation: EXISTS (id=100)
Action: UPDATE

1. Get version: max=1, next=2
2. Fetch old items: uuid-A (created_at=2024-01-01), uuid-B (...)
3. Archive to history (version=2)
4. Delete current
5. Insert from CSV:
   - uuid-A: created_at=2024-01-01 (preserved), qty=60
   - uuid-B: created_at=2024-01-01 (preserved), qty=100
   - new UUID: created_at=NOW(), qty=20
6. Update estimation totals

Result:
estimation_items:
- stable_item_id=uuid-A, qty=60, created_at=2024-01-01 ✓ Preserved
- stable_item_id=uuid-B, qty=100, created_at=2024-01-01 ✓ Preserved
- stable_item_id=uuid-C, qty=20, created_at=NOW() ✓ New

estimation_items_history:
- stable_item_id=uuid-A, qty=50, version=1
- stable_item_id=uuid-B, qty=100, version=1
```

---

### Example 3: Delete Item via CSV

**User Actions:**
1. Download template
2. Remove row with stable_item_id=uuid-B
3. Upload CSV

**CSV Content:**
```csv
stable_item_id,Category,Room Name,Item Name,Quantity,...
uuid-A,Furniture,Living Room,TV Unit,60,...           # Keep
                                                       # uuid-B removed
,Furniture,Kitchen,Cabinet,20,...                      # New
```

**Backend:**
```
Archive all current items
Re-insert only items in CSV

Result:
estimation_items:
- uuid-A (kept)
- uuid-C (new)

estimation_items_history:
- uuid-A (version 1)
- uuid-B (version 1, version 2) ← Deleted from current, exists in history
```

---

## Benefits

### 1. Consistent Workflow ✅
```
UI Edit:  Archive → Delete → Re-insert
CSV Edit: Archive → Delete → Re-insert

Same logic, same behavior!
```

### 2. Item Tracking ✅
```
stable_item_id in CSV allows:
- Track items across versions
- Preserve creation audit
- Maintain history
```

### 3. Flexible Editing ✅
```
Users can:
- Edit existing items (include stable_item_id)
- Add new items (leave stable_item_id empty)
- Delete items (remove row from CSV)
```

### 4. No Data Loss ✅
```
All versions preserved in history
Can see how items changed over time
Complete audit trail
```

### 5. User-Friendly ✅
```
Download → Edit → Upload (natural workflow)
No need to delete estimation first
Can make incremental changes
```

---

## CSV Template Structure

### Header Row:
```csv
stable_item_id,Category,Room Name,Vendor Type,Item Name,Unit,Width,Height,Quantity,Unit Price,Subtotal,KG Charges %,KG Charges Amount,Item Discount %,Item Discount Amount,Discount KG Charges %,Discount KG Charges Amount,GST %,GST Amount,Amount Before GST,Item Total,Status
```

### Data Rows (Existing Estimation):
```csv
uuid-abc-123,Furniture,Living Room,Type A,TV Unit,nos,0,0,50,5000,250000,10,25000,5,12500,2,500,18,41220,229000,270220,queued
uuid-def-456,Furniture,Bedroom,Type A,Wardrobe,nos,0,0,100,3000,300000,10,30000,0,0,0,0,18,54000,300000,354000,queued
```

### Data Rows (New Items - Add by User):
```csv
,Furniture,Kitchen,Type B,Cabinet,nos,0,0,20,2000,40000,10,4000,0,0,0,0,18,7200,40000,47200,queued
```

**Key Points:**
- First column is `stable_item_id`
- Existing items have UUID filled in
- New items have empty `stable_item_id`
- User should NOT modify stable_item_id (except to delete by removing row)

---

## Edge Cases

### Case 1: User Modifies stable_item_id
```csv
wrong-uuid,Furniture,Living Room,TV Unit,...
```

**Handling:**
- Backend checks if UUID exists in oldItemsMap
- If not found: Treats as new item (generates new UUID)
- Recommendation: Add validation to warn user

### Case 2: Duplicate stable_item_id in CSV
```csv
uuid-A,Furniture,Living Room,TV Unit,...
uuid-A,Furniture,Bedroom,Wardrobe,...  ← Duplicate!
```

**Handling:**
- Database UNIQUE constraint will fail
- Rollback transaction
- Return error to user

### Case 3: Invalid CSV Format
```csv
Missing columns or wrong order
```

**Handling:**
- Validation at parse stage
- Check required columns exist
- Return clear error message

---

## Testing Checklist

### Test 1: First Time Upload ✅
- [ ] No estimation exists
- [ ] Upload CSV with 3 items (no stable_item_id)
- [ ] Verify estimation created
- [ ] Verify items have stable_item_id generated

### Test 2: Download Template ✅
- [ ] Estimation exists with 3 items
- [ ] Download template
- [ ] Verify CSV includes stable_item_id column
- [ ] Verify stable_item_id values present for existing items

### Test 3: Edit and Re-upload ✅
- [ ] Download template
- [ ] Edit one item (change quantity)
- [ ] Upload CSV
- [ ] Verify item updated with preserved created_at
- [ ] Verify version incremented in history

### Test 4: Add New Item ✅
- [ ] Download template
- [ ] Add row with empty stable_item_id
- [ ] Upload CSV
- [ ] Verify new item gets fresh UUID
- [ ] Verify existing items unchanged

### Test 5: Delete Item ✅
- [ ] Download template
- [ ] Remove one row
- [ ] Upload CSV
- [ ] Verify item deleted from current table
- [ ] Verify item exists in history

---

## Files to Modify

### 1. Template Download
**File:** `/app/app/api/projects/[id]/estimations/template/route.js`
- Add `stable_item_id` to SELECT query
- Add `stable_item_id` as first column in CSV headers
- Include `stable_item_id` in data rows

### 2. CSV Upload
**File:** `/app/app/api/projects/[id]/estimations/upload/route.js`
- Parse `stable_item_id` from CSV
- Check if estimation exists (don't reject)
- Implement CREATE logic (if not exists)
- Implement UPDATE logic (if exists)
  - Archive items
  - Delete items
  - Re-insert with preserved/new audit
  - Update estimation totals

---

## Implementation Effort

**Estimated Time:** 4-6 hours
- Template download update: 1 hour
- CSV upload refactor: 2-3 hours
- Testing: 1-2 hours

---

## Recommendation

✅ **Proceed with this approach**

**Why:**
1. Makes CSV workflow consistent with UI workflow
2. Enables proper item tracking across versions
3. Preserves audit trail
4. User-friendly (download → edit → upload)
5. No data loss
6. Follows same pattern as PR item versioning

**This will make the CSV upload feature as powerful as the UI editor!**
