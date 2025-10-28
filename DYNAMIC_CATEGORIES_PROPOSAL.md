# Dynamic Categories Implementation Proposal

## Overview
Move from hardcoded ESTIMATION_CATEGORY constant to fully dynamic category system driven by `category_rates` JSONB from project_base_rates.

---

## Proposed Changes

### **1. Update category_rates JSONB Structure**

**Add Two New Fields:**

**Current Structure:**
```json
{
  "id": "woodwork",
  "category_name": "Woodwork",
  "kg_label": "Design and Consultation",
  "max_item_discount_percentage": 20,
  "kg_percentage": 10,
  "max_kg_discount_percentage": 50
}
```

**New Structure:**
```json
{
  "id": "woodwork",
  "category_name": "Woodwork",
  "kg_label": "Design and Consultation",
  "max_item_discount_percentage": 20,
  "kg_percentage": 10,
  "max_kg_discount_percentage": 50,
  "pay_to_vendor_directly": false,     // NEW: Controls subtotal inclusion in amount_before_gst
  "sort_order": 1                       // NEW: For display ordering
}
```

**Default Values for Standard Categories:**
```json
[
  {
    "id": "woodwork",
    "category_name": "Woodwork",
    "kg_label": "Design and Consultation",
    "max_item_discount_percentage": 20,
    "kg_percentage": 10,
    "max_kg_discount_percentage": 50,
    "pay_to_vendor_directly": false,
    "sort_order": 1
  },
  {
    "id": "misc",
    "category_name": "Misc",
    "kg_label": "Service Charges",
    "max_item_discount_percentage": 20,
    "kg_percentage": 8,
    "max_kg_discount_percentage": 40,
    "pay_to_vendor_directly": false,
    "sort_order": 2
  },
  {
    "id": "shopping",
    "category_name": "Shopping",
    "kg_label": "Shopping Service Charges",
    "max_item_discount_percentage": 20,
    "kg_percentage": 5,
    "max_kg_discount_percentage": 30,
    "pay_to_vendor_directly": true,      // Customer pays vendor directly
    "sort_order": 3
  }
]
```

---

### **2. Database Migration**

**File: `/app/migrate_add_category_flags.sql`**

```sql
-- Update existing biz_models category_rates
UPDATE biz_models
SET category_rates = jsonb_set(
  jsonb_set(
    category_rates,
    '{categories}',
    (
      SELECT jsonb_agg(
        category || 
        jsonb_build_object('pay_to_vendor_directly', 
          CASE WHEN category->>'id' = 'shopping' THEN true ELSE false END
        ) ||
        jsonb_build_object('sort_order',
          CASE 
            WHEN category->>'id' = 'woodwork' THEN 1
            WHEN category->>'id' = 'misc' THEN 2
            WHEN category->>'id' = 'shopping' THEN 3
            ELSE 999
          END
        )
      )
      FROM jsonb_array_elements(category_rates->'categories') AS category
    )
  ),
  '{}'
)
WHERE category_rates IS NOT NULL;

-- Same for project_base_rates
UPDATE project_base_rates
SET category_rates = jsonb_set(
  jsonb_set(
    category_rates,
    '{categories}',
    (
      SELECT jsonb_agg(
        category || 
        jsonb_build_object('pay_to_vendor_directly', 
          CASE WHEN category->>'id' = 'shopping' THEN true ELSE false END
        ) ||
        jsonb_build_object('sort_order',
          CASE 
            WHEN category->>'id' = 'woodwork' THEN 1
            WHEN category->>'id' = 'misc' THEN 2
            WHEN category->>'id' = 'shopping' THEN 3
            ELSE 999
          END
        )
      )
      FROM jsonb_array_elements(category_rates->'categories') AS category
    )
  ),
  '{}'
)
WHERE category_rates IS NOT NULL;
```

---

### **3. BizModel UI Updates**

**File: `/app/app/settings/bizmodels/page.js`**

**Add Two New Fields in Category Form:**

```javascript
// In the Categories & Rates tab
{categories.map((category, index) => (
  <div key={index} className="border rounded-lg p-4 space-y-3 bg-slate-50">
    {/* ... existing fields ... */}
    
    <div className="grid md:grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label className="text-xs">Sort Order</Label>
        <Input
          type="number"
          value={category.sort_order}
          onChange={(e) => updateCategory(index, 'sort_order', parseInt(e.target.value))}
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">Display order (1, 2, 3...)</p>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs">Payment Type</Label>
        <div className="flex items-center space-x-2 h-9">
          <input
            type="checkbox"
            checked={category.pay_to_vendor_directly || false}
            onChange={(e) => updateCategory(index, 'pay_to_vendor_directly', e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">Customer pays vendor directly</span>
        </div>
        <p className="text-xs text-muted-foreground">If checked, only KG charges billed to customer</p>
      </div>
    </div>
  </div>
))}
```

**Update Initial State:**
```javascript
const [categories, setCategories] = useState([
  {
    id: 'woodwork',
    category_name: 'Woodwork',
    kg_label: 'Design and Consultation',
    max_item_discount_percentage: 20,
    kg_percentage: 10,
    max_kg_discount_percentage: 50,
    pay_to_vendor_directly: false,  // NEW
    sort_order: 1                    // NEW
  },
  // ... others
]);
```

---

### **4. Manage Estimation Page Updates**

**File: `/app/app/projects/[id]/manage-estimation/page.js`**

**A. Remove ESTIMATION_CATEGORY Import:**
```javascript
// OLD
import { ESTIMATION_CATEGORY, ESTIMATION_STATUS } from '@/app/constants';

// NEW
import { ESTIMATION_STATUS } from '@/app/constants';
```

**B. Get Categories Dynamically from project_base_rates:**
```javascript
const [categoryOptions, setCategoryOptions] = useState([]);

// In fetchEstimationDetails or useEffect
const categories = bizModel.category_rates?.categories || [];
const options = categories
  .sort((a, b) => a.sort_order - b.sort_order)
  .map(cat => ({
    value: cat.id,
    label: cat.category_name
  }));
setCategoryOptions(options);
```

**C. Update Category Dropdown:**
```javascript
// OLD
options={Object.entries(ESTIMATION_CATEGORY).map(([key, value]) => ({
  value: value,
  label: value.replace('_', ' ')
}))}

// NEW
options={categoryOptions}
```

**D. Update calculateItemTotal Function (Lines 570-576):**
```javascript
// OLD - Hardcoded check
if (item.category === 'shopping_service') {
  amountBeforeGst = kgChargesNet;
} else {
  amountBeforeGst = discountedSubtotal + kgChargesNet;
}

// NEW - Flag-based check
const categoryConfig = getCategoryConfig(item.category);
if (categoryConfig?.pay_to_vendor_directly) {
  // Customer pays vendor directly, only KG charges billed
  amountBeforeGst = kgChargesNet;
} else {
  // Full billing: items + KG charges
  amountBeforeGst = discountedSubtotal + kgChargesNet;
}
```

**E. Update calculateTotals Function:**
```javascript
// OLD - Hardcoded category checks
if (item.category === ESTIMATION_CATEGORY.WOODWORK) {
  woodworkSubtotal += itemCalc.subtotal;
  // ...
} else if (item.category === ESTIMATION_CATEGORY.MISC_INTERNAL) {
  // ...
}

// NEW - Dynamic category aggregation
const categories = bizModel.category_rates?.categories || [];
const categoryTotals = {};

// Initialize totals for each category
categories.forEach(cat => {
  categoryTotals[cat.id] = {
    subtotal: 0,
    total: 0,
    itemDiscounts: 0,
    kgDiscounts: 0,
    kgCharges: 0,
    gst: 0,
    amountBeforeGst: 0
  };
});

// Aggregate by category
data.forEach(item => {
  const itemCalc = calculateItemTotal(item);
  const catId = getCategoryIdFromItemCategory(item.category);
  
  if (categoryTotals[catId]) {
    categoryTotals[catId].subtotal += itemCalc.subtotal;
    categoryTotals[catId].itemDiscounts += itemCalc.item_discount_amount;
    categoryTotals[catId].kgCharges += itemCalc.karighar_charges_amount;
    categoryTotals[catId].kgDiscounts += itemCalc.kg_discount_amount;
    categoryTotals[catId].amountBeforeGst += itemCalc.amount_before_gst;
    categoryTotals[catId].gst += itemCalc.gst_amount;
    categoryTotals[catId].total += itemCalc.item_total;
  }
});

// Build category_breakdown JSONB
const categoryBreakdown = {};
Object.entries(categoryTotals).forEach(([catId, totals]) => {
  categoryBreakdown[catId] = {
    subtotal: totals.subtotal,
    item_discount_amount: totals.itemDiscounts,
    discounted_subtotal: totals.subtotal - totals.itemDiscounts,
    kg_charges_gross: totals.kgCharges + totals.kgDiscounts,
    kg_charges_discount: totals.kgDiscounts,
    kg_charges_net: totals.kgCharges,
    amount_before_gst: totals.amountBeforeGst,
    gst_amount: totals.gst,
    total: totals.total
  };
});
```

**F. Update Category Mapping Helper:**
```javascript
// OLD - Hardcoded mapping
const categoryMap = {
  [ESTIMATION_CATEGORY.WOODWORK]: 'woodwork',
  [ESTIMATION_CATEGORY.MISC_INTERNAL]: 'misc',
  [ESTIMATION_CATEGORY.MISC_EXTERNAL]: 'misc',
  [ESTIMATION_CATEGORY.SHOPPING_SERVICE]: 'shopping'
};

// NEW - Use category ID directly from estimation_items
// No mapping needed! estimation_items.category already stores the category ID
const getCategoryConfig = (itemCategory) => {
  return bizModel.category_rates?.categories?.find(c => c.id === itemCategory);
};
```

---

### **5. Project Detail Page Updates**

**File: `/app/app/projects/[id]/page.js`**

**A. Remove ESTIMATION_CATEGORY Import:**
```javascript
// OLD
import { ESTIMATION_CATEGORY, PROJECT_STAGES, USER_ROLE } from '@/app/constants';

// NEW
import { PROJECT_STAGES, USER_ROLE } from '@/app/constants';
```

**B. Update sortingFn to Use sort_order:**
```javascript
// Get categories from project_base_rates (fetch from context or API)
const [projectBaseRates, setProjectBaseRates] = useState(null);

useEffect(() => {
  // Fetch active base rates
  fetch(`/api/projects/${projectId}/base-rates/active`)
    .then(res => res.json())
    .then(data => setProjectBaseRates(data));
}, [projectId]);

// Column definition
{
  accessorKey: 'category',
  header: 'Category',
  enableGrouping: true,
  cell: ({ getValue }) => {
    const value = getValue();
    return value?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  },
  sortingFn: (rowA, rowB) => {
    const categories = projectBaseRates?.category_rates?.categories || [];
    
    // Build sort order map from category_rates
    const categoryOrder = {};
    categories.forEach(cat => {
      categoryOrder[cat.id] = cat.sort_order;
    });
    
    const a = categoryOrder[rowA.original.category] || 999;
    const b = categoryOrder[rowB.original.category] || 999;
    return a - b;
  },
}
```

**C. Update Category Display Cards (Lines 379-391):**
```javascript
// OLD - Hardcoded labels
<p className="text-sm text-muted-foreground mb-1">{UIFriendly(ESTIMATION_CATEGORY.WOODWORK)}</p>

// NEW - Dynamic from category_breakdown keys
{estimation.category_breakdown && Object.entries(estimation.category_breakdown).map(([catId, catData]) => {
  const category = projectBaseRates?.category_rates?.categories?.find(c => c.id === catId);
  return (
    <div key={catId} className="p-3 bg-green-50 border border-green-200 rounded">
      <p className="text-sm text-muted-foreground mb-1">{category?.category_name || catId}</p>
      <p className="text-xl font-bold">{formatCurrency(catData.total || 0)}</p>
    </div>
  );
})}
```

---

### **6. Constants File Update**

**File: `/app/app/constants.js`**

**Remove ESTIMATION_CATEGORY:**
```javascript
// DELETE THIS ENTIRE BLOCK
export const ESTIMATION_CATEGORY = {
  WOODWORK: 'woodwork',
  MISC_INTERNAL: "misc_internal",
  MISC_EXTERNAL: "misc_external",
  SHOPPING_SERVICE: "shopping_service"
}
```

**Keep Other Constants:**
- ESTIMATION_STATUS ✅
- ALERT_TYPE ✅
- All other constants ✅

---

### **7. Schema Updates**

**Update schema.sql Comments:**
```sql
COMMENT ON COLUMN biz_models.category_rates IS 'JSONB structure: {
  "categories": [{
    "id": "woodwork",
    "category_name": "Woodwork",
    "kg_label": "Design and Consultation",
    "max_item_discount_percentage": 20,
    "kg_percentage": 10,
    "max_kg_discount_percentage": 50,
    "pay_to_vendor_directly": false,
    "sort_order": 1
  }]
}. Flexible category-based pricing rules with vendor payment flag and display order.';
```

---

## Impact Analysis

### **Files to Modify:**

1. **Database:**
   - Migration script to add new fields to existing category_rates

2. **Backend APIs:**
   - No changes needed (already using category_rates)

3. **Frontend Pages:**
   - `/app/app/settings/bizmodels/page.js` - Add UI fields
   - `/app/app/projects/[id]/manage-estimation/page.js` - Dynamic categories, flag-based calculation
   - `/app/app/projects/[id]/page.js` - Dynamic sorting and display
   - `/app/app/constants.js` - Remove ESTIMATION_CATEGORY

4. **Schema:**
   - `/app/schema.sql` - Update comments

---

## Benefits

✅ **Flexibility:** Users can create unlimited custom categories
✅ **No Code Changes:** Add/remove categories without code deployment
✅ **Better Control:** pay_to_vendor_directly flag handles special billing cases
✅ **Clean Display:** sort_order controls consistent ordering everywhere
✅ **Maintainability:** No hardcoded category checks scattered in code
✅ **Scalability:** Easy to add new category fields in future

---

## Risks & Mitigations

**Risk 1: Existing Data**
- **Mitigation:** Migration script adds defaults for all existing categories

**Risk 2: Backward Compatibility**
- **Mitigation:** estimation_items.category already stores category IDs, no data change needed

**Risk 3: Category Mapping**
- **Current:** misc_internal and misc_external both map to 'misc'
- **Solution:** Keep this mapping OR split into separate categories in category_rates
- **Recommendation:** Add misc_internal and misc_external as separate categories with same base settings

**Risk 4: Missing Category Config**
- **Mitigation:** Add fallback logic if category not found in category_rates

---

## Recommended Category Setup

**Default Categories in category_rates:**
```json
[
  {
    "id": "woodwork",
    "category_name": "Woodwork",
    "kg_label": "Design and Consultation",
    "max_item_discount_percentage": 20,
    "kg_percentage": 10,
    "max_kg_discount_percentage": 50,
    "pay_to_vendor_directly": false,
    "sort_order": 1
  },
  {
    "id": "misc_internal",
    "category_name": "Misc Internal",
    "kg_label": "Service Charges",
    "max_item_discount_percentage": 20,
    "kg_percentage": 8,
    "max_kg_discount_percentage": 40,
    "pay_to_vendor_directly": false,
    "sort_order": 2
  },
  {
    "id": "misc_external",
    "category_name": "Misc External",
    "kg_label": "Service Charges",
    "max_item_discount_percentage": 20,
    "kg_percentage": 8,
    "max_kg_discount_percentage": 40,
    "pay_to_vendor_directly": false,
    "sort_order": 3
  },
  {
    "id": "shopping_service",
    "category_name": "Shopping Service",
    "kg_label": "Shopping Service Charges",
    "max_item_discount_percentage": 20,
    "kg_percentage": 5,
    "max_kg_discount_percentage": 30,
    "pay_to_vendor_directly": true,
    "sort_order": 4
  }
]
```

This keeps existing estimation_items data intact (they already have correct category IDs).

---

## Additional Requirements Identified

**1. Category Validation:**
- When creating estimation items, validate category ID exists in project_base_rates

**2. Category Deletion:**
- Prevent deletion of categories that have existing estimation items
- OR provide migration path to reassign items

**3. UI Feedback:**
- Show indicator when pay_to_vendor_directly is true (e.g., "Vendor Payment" badge)
- Display sort_order in category management

**4. Reports & Dashboard:**
- Update any hardcoded category references in reports
- Use dynamic category loading

**5. Display Labels:**
- Use category_name from category_rates instead of transforming category ID
- Show kg_label in KG charges column header

---

## Testing Checklist

- [ ] Create new BizModel with new fields
- [ ] Edit existing BizModel, verify migration worked
- [ ] Create estimation with shopping category
- [ ] Verify amount_before_gst calculation based on flag
- [ ] Check category dropdown shows all categories
- [ ] Verify sorting works by sort_order
- [ ] Test with custom category (not in defaults)
- [ ] Check project detail page displays all categories
- [ ] Verify totals calculation aggregates correctly
- [ ] Test category_breakdown JSONB saves correctly

---

## Questions for Approval

1. **Category Naming:** Should we split 'misc' into 'misc_internal' and 'misc_external' in category_rates?
   - Current: Both map to single 'misc' 
   - Proposed: Separate entries with same rates but different sort_order

2. **Migration Timing:** Should we migrate existing data immediately or keep old structure until tested?
   - Recommendation: Migrate immediately since it's additive (no data loss)

3. **Fallback Behavior:** What should happen if estimation item has category not in category_rates?
   - Option A: Show error, don't allow save
   - Option B: Use default values (0% charges)
   - Recommendation: Option A (strict validation)

4. **UI Display:** Should we show pay_to_vendor_directly flag in manage-estimation table?
   - Could add tooltip/indicator on category cells

5. **Performance:** With dynamic categories, should we cache category_rates in context?
   - Recommendation: Yes, fetch once and store in ProjectDataContext

---

## Approval Required

Please review and approve:
1. ✅ / ❌ JSONB structure changes (pay_to_vendor_directly, sort_order)
2. ✅ / ❌ Removal of ESTIMATION_CATEGORY constant
3. ✅ / ❌ Dynamic category loading approach
4. ✅ / ❌ Calculation logic using flag instead of hardcoded category
5. ✅ / ❌ Category setup (4 categories vs 3)
6. ✅ / ❌ Migration approach
7. ✅ / ❌ Any modifications to the proposal

After approval, I will implement all changes systematically without testing.
