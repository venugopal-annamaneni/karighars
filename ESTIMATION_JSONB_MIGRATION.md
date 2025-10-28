# Estimation Schema Migration to JSONB - Complete Implementation

## Overview
Successfully migrated estimation_items and project_estimations tables to support flexible JSONB-based category structure, replacing hardcoded category columns with dynamic category breakdown.

---

## Migration Summary

### **Part 1: estimation_items Schema Update**

#### **New Columns Added:**

**Item-Level Discount (Applied BEFORE KG Charges):**
- `item_discount_percentage` (NUMERIC) - Discount % on item subtotal
- `item_discount_amount` (NUMERIC) - Calculated discount amount on subtotal

**KG Charges Discount (Applied ON KG Charges):**
- `discount_kg_charges_percentage` (NUMERIC) - Discount % on KG charges only
- `discount_kg_charges_amount` (NUMERIC) - Calculated discount amount on KG charges

**Legacy Columns (Preserved for migration):**
- `discount_percentage` - Old discount field
- `discount_amount` - Old discount amount field

#### **Updated Calculation Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Base Calculation                                   │
│  Subtotal = Quantity × Unit Price                          │
│  Example: 100 sqft × ₹500 = ₹50,000                       │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Apply Item Discount                                │
│  (from category_rates.max_item_discount_percentage)         │
│  Item Discount = ₹50,000 × 10% = ₹5,000                    │
│  Discounted Subtotal = ₹50,000 - ₹5,000 = ₹45,000         │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Calculate KG Charges                               │
│  (from category_rates.kg_percentage)                        │
│  KG Charges Gross = ₹45,000 × 10% = ₹4,500                │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Apply KG Charges Discount                          │
│  (from category_rates.max_kg_discount_percentage)           │
│  KG Discount = ₹4,500 × 20% = ₹900                         │
│  KG Charges Net = ₹4,500 - ₹900 = ₹3,600                  │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Calculate Amount Before GST                        │
│  Amount Before GST = ₹45,000 + ₹3,600 = ₹48,600           │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Apply GST                                          │
│  GST Amount = ₹48,600 × 18% = ₹8,748                       │
│  Item Total = ₹48,600 + ₹8,748 = ₹57,348                  │
└─────────────────────────────────────────────────────────────┘
```

---

### **Part 2: project_estimations Schema Update**

#### **Removed Columns (Legacy - kept temporarily):**
- `woodwork_value`
- `misc_internal_value`
- `misc_external_value`
- `shopping_service_value`

#### **New Columns Added:**

**1. category_breakdown (JSONB)** - Dynamic category-wise totals
```json
{
  "woodwork": {
    "subtotal": 500000,
    "item_discount_amount": 50000,
    "discounted_subtotal": 450000,
    "kg_charges_gross": 45000,
    "kg_charges_discount": 9000,
    "kg_charges_net": 36000,
    "amount_before_gst": 486000,
    "gst_amount": 87480,
    "total": 573480
  },
  "misc": {
    "subtotal": 200000,
    "item_discount_amount": 10000,
    "discounted_subtotal": 190000,
    "kg_charges_gross": 15200,
    "kg_charges_discount": 3040,
    "kg_charges_net": 12160,
    "amount_before_gst": 202160,
    "gst_amount": 36389,
    "total": 238549
  },
  "custom_category_xyz": {
    // Same structure - unlimited categories supported
  }
}
```

**2. Aggregate Totals (For Fast Queries):**
- `total_items_value` (NUMERIC) - Sum of all discounted subtotals
- `total_kg_charges` (NUMERIC) - Sum of all final KG charges
- `total_discount_amount` (NUMERIC) - Sum of all discounts (item + KG)
- `gst_amount` (NUMERIC) - Total GST across all categories
- `final_value` (NUMERIC) - Grand total

**3. GIN Index for JSONB:**
```sql
CREATE INDEX idx_project_estimations_category_breakdown 
ON project_estimations USING gin(category_breakdown);
```

---

## **Key Benefits**

### **1. Flexibility**
✅ Supports unlimited custom categories from biz_models
✅ No schema changes needed when adding new categories
✅ Dynamic category names and labels

### **2. Performance**
✅ High-level totals in flat columns for fast queries
✅ GIN index for efficient JSONB queries
✅ No joins needed for summary reports

### **3. Data Integrity**
✅ Structured JSONB with consistent fields per category
✅ Queryable using JSONB operators
✅ Self-documenting (category names as keys)

### **4. Compatibility**
✅ Aligns perfectly with category_rates JSONB in biz_models
✅ Supports dynamic categories from project_base_rates
✅ Backward compatible with legacy columns

---

## **Database Queries Examples**

### **1. Get All Categories:**
```sql
SELECT 
    id,
    project_id,
    category_breakdown
FROM project_estimations 
WHERE project_id = 1;
```

### **2. Get Specific Category Total:**
```sql
SELECT 
    id,
    project_id,
    category_breakdown->'woodwork'->>'total' AS woodwork_total,
    category_breakdown->'misc'->>'total' AS misc_total
FROM project_estimations 
WHERE project_id = 1;
```

### **3. Filter by Category Value:**
```sql
SELECT * 
FROM project_estimations
WHERE (category_breakdown->'woodwork'->>'total')::numeric > 500000;
```

### **4. Get All Category Names:**
```sql
SELECT 
    id,
    jsonb_object_keys(category_breakdown) AS category_name
FROM project_estimations 
WHERE project_id = 1;
```

### **5. Aggregate Across Projects:**
```sql
SELECT 
    SUM(total_items_value) AS total_items,
    SUM(total_kg_charges) AS total_kg,
    SUM(total_discount_amount) AS total_discounts,
    SUM(final_value) AS grand_total
FROM project_estimations
WHERE status = 'finalized';
```

### **6. Category-wise Breakdown:**
```sql
SELECT 
    project_id,
    jsonb_object_keys(category_breakdown) AS category,
    (category_breakdown->jsonb_object_keys(category_breakdown)->>'subtotal')::numeric AS subtotal,
    (category_breakdown->jsonb_object_keys(category_breakdown)->>'total')::numeric AS total
FROM project_estimations
WHERE project_id = 1;
```

---

## **API/Business Logic Changes Needed**

### **1. Estimation Save API** (`/api/projects/[id]/estimations`)

**Current Flow:**
- Saves estimation items
- Calculates category totals in flat columns

**New Flow:**
```javascript
// Step 1: Calculate category-wise totals from estimation_items
const categoryTotals = {};

for (const item of items) {
  if (!categoryTotals[item.category]) {
    categoryTotals[item.category] = {
      subtotal: 0,
      item_discount_amount: 0,
      discounted_subtotal: 0,
      kg_charges_gross: 0,
      kg_charges_discount: 0,
      kg_charges_net: 0,
      amount_before_gst: 0,
      gst_amount: 0,
      total: 0
    };
  }
  
  const cat = categoryTotals[item.category];
  cat.subtotal += item.subtotal;
  cat.item_discount_amount += item.item_discount_amount;
  cat.discounted_subtotal += (item.subtotal - item.item_discount_amount);
  cat.kg_charges_gross += item.karighar_charges_amount;
  cat.kg_charges_discount += item.discount_kg_charges_amount;
  cat.kg_charges_net += (item.karighar_charges_amount - item.discount_kg_charges_amount);
  cat.amount_before_gst += item.amount_before_gst;
  cat.gst_amount += item.gst_amount;
  cat.total += item.item_total;
}

// Step 2: Calculate high-level aggregates
const total_items_value = Object.values(categoryTotals)
  .reduce((sum, cat) => sum + cat.discounted_subtotal, 0);

const total_kg_charges = Object.values(categoryTotals)
  .reduce((sum, cat) => sum + cat.kg_charges_net, 0);

const total_discount_amount = Object.values(categoryTotals)
  .reduce((sum, cat) => sum + cat.item_discount_amount + cat.kg_charges_discount, 0);

const gst_amount = Object.values(categoryTotals)
  .reduce((sum, cat) => sum + cat.gst_amount, 0);

const final_value = Object.values(categoryTotals)
  .reduce((sum, cat) => sum + cat.total, 0);

// Step 3: Save to database
await query(`
  UPDATE project_estimations SET
    category_breakdown = $1,
    total_items_value = $2,
    total_kg_charges = $3,
    total_discount_amount = $4,
    gst_amount = $5,
    final_value = $6
  WHERE id = $7
`, [
  JSON.stringify(categoryTotals),
  total_items_value,
  total_kg_charges,
  total_discount_amount,
  gst_amount,
  final_value,
  estimationId
]);
```

### **2. Dashboard/Reports**

**Fast Queries (Use Flat Columns):**
```javascript
// Get high-level totals
const result = await query(`
  SELECT 
    SUM(total_items_value) as total_items,
    SUM(total_kg_charges) as total_kg,
    SUM(final_value) as total_revenue
  FROM project_estimations
  WHERE status = 'finalized'
`);
```

**Detailed Breakdown (Use JSONB):**
```javascript
// Get category-wise breakdown
const result = await query(`
  SELECT 
    project_id,
    category_breakdown
  FROM project_estimations
  WHERE project_id = $1
`, [projectId]);

const categories = result.rows[0].category_breakdown;
// categories = { woodwork: {...}, misc: {...}, ... }
```

### **3. Ledger/Invoicing**

**No changes needed** - Uses `final_value` which remains same

---

## **Migration Status**

### **Completed:**
- ✅ estimation_items columns added
- ✅ project_estimations JSONB columns added
- ✅ GIN index created
- ✅ Data migration completed (0 records migrated as no existing data)
- ✅ schema.sql updated with new structure
- ✅ Column comments added

### **Pending (Phase 3):**
- ⏳ Update estimation save API to populate category_breakdown
- ⏳ Update manage-estimation page to use new discount fields
- ⏳ Update dashboard to parse JSONB for category charts
- ⏳ Update reports to support dynamic categories
- ⏳ Drop legacy columns after verification

---

## **Testing Checklist**

- [ ] Create new estimation with items
- [ ] Verify category_breakdown JSONB is populated correctly
- [ ] Verify aggregate totals match JSONB totals
- [ ] Query specific category totals
- [ ] Test with custom categories (beyond default 4)
- [ ] Verify item-level discounts apply before KG charges
- [ ] Verify KG discount applies on KG charges only
- [ ] Test dashboard with new structure
- [ ] Test reports with JSONB queries
- [ ] Verify ledger uses final_value correctly

---

## **Files Modified**

1. `/app/migrate_estimation_items_schema.sql` (NEW)
2. `/app/migrate_project_estimations_jsonb.sql` (NEW)
3. `/app/schema.sql` (estimation_items, project_estimations)
4. `/app/ESTIMATION_JSONB_MIGRATION.md` (this file)

---

## **Rollback Plan**

If needed, legacy columns are preserved:
```sql
-- Restore from legacy columns
UPDATE project_estimations SET
  final_value = woodwork_value + misc_internal_value + 
                misc_external_value + shopping_service_value
WHERE category_breakdown != '{}'::jsonb;

-- Remove JSONB columns
ALTER TABLE project_estimations 
  DROP COLUMN category_breakdown,
  DROP COLUMN total_items_value,
  DROP COLUMN total_kg_charges,
  DROP COLUMN total_discount_amount;
```

---

## **Next Steps**

**Phase 3: Update Estimation Logic**
1. Update `/api/projects/[id]/estimations` POST/PUT to populate category_breakdown
2. Update item calculation logic to use new discount fields
3. Aggregate items by category and build JSONB
4. Populate high-level totals
5. Test thoroughly

**Phase 4: Update UI**
1. Update manage-estimation page for new discount fields
2. Update dashboard to parse JSONB
3. Update reports for dynamic categories
4. Add category-wise filtering

**Phase 5: Cleanup**
1. Verify all features working
2. Drop legacy columns
3. Update all documentation
4. Train users on new features

---

## **Summary**

✅ **Database schemas updated** for both tables
✅ **JSONB structure** supports unlimited dynamic categories
✅ **Performance optimized** with flat columns + JSONB
✅ **Backward compatible** with legacy columns preserved
✅ **Ready for Phase 3** - API and UI updates

This migration provides the foundation for a flexible, scalable estimation system that adapts to any number of categories without schema changes.
