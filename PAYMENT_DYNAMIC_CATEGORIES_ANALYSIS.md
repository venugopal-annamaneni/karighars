# Impact Analysis: Dynamic Categories on Payment Calculation & Customer Payments

## Current System (Hardcoded Categories)

### 1. Calculate Payment API (`/app/api/projects/[id]/calculate-payment/route.js`)
**Current Logic:**
```javascript
// Line 20-21: Fetches hardcoded category values from estimation
SELECT woodwork_value, misc_internal_value, misc_external_value, shopping_service_value, final_value

// Line 36-37: Fetches hardcoded percentages from milestone
SELECT milestone_code, milestone_name, woodwork_percentage, misc_percentage, shopping_percentage

// Line 48-54: Calculates totals for 3 hardcoded categories
SELECT 
  SUM(CASE WHEN category = 'woodwork' THEN item_total ELSE 0 END) as woodwork_total,
  SUM(CASE WHEN category IN ('misc_internal', 'misc_external') THEN item_total ELSE 0 END) as misc_total,
  SUM(CASE WHEN category IN ('shopping_service') THEN item_total ELSE 0 END) as shopping_total

// Line 60-68: Calculates target amounts for 3 categories
targetWoodworkAmount = (woodworkTotal * woodworkPercentage) / 100
targetMiscAmount = (miscTotal * miscPercentage) / 100
targetShoppingAmount = (shoppingTotal * shoppingPercentage) / 100

// Line 82-102: Returns hardcoded response
{
  woodwork_total, target_woodwork_percentage, target_woodwork_amount,
  misc_total, target_misc_percentage, target_misc_amount,
  shopping_total, target_shopping_percentage, target_shopping_amount,
  target_total, collected_total, expected_total
}
```

### 2. Customer Payments Page (`/app/app/projects/[id]/customer-payments/page.js`)
**Current UI Issues:**
```javascript
// Line 170-173: Hardcoded category extraction from API response
const woodworkAmt = data.target_woodwork_amount?.toFixed(2) || 0;
const miscAmt = data.target_misc_amount?.toFixed(2) || 0;
const shoppingAmt = data.target_shopping_amount?.toFixed(2) || 0;

// Line 303: Displays hardcoded category percentages in dropdown
W:${milestone.woodwork_percentage}% M:${milestone.misc_percentage}% S:${milestone.shopping_percentage}%

// Line 316-346: Hardcoded category breakdown display
- 🪵 Woodwork Component
- 🔧 Misc Component
- 🛒 Shopping Component
```

---

## Required Changes for Dynamic Categories

### Problem Statement
1. **Milestones now store**: `category_percentages` JSONB (e.g., `{"woodwork": 30, "misc": 50, "shopping": 100}`)
2. **Categories are dynamic**: Defined in `biz_models.category_rates`, not hardcoded to 3
3. **Estimation stores**: `category_breakdown` JSONB with dynamic category totals
4. **Need to support**: N categories (4, 5, 10, etc.) not just woodwork/misc/shopping

---

## Proposed Solution

### Phase 1: Update Calculate Payment API

#### 1.1 Fetch Dynamic Categories from BizModel
```javascript
// Get project's biz_model to fetch category definitions
const bizModelRes = await query(`
  SELECT bm.category_rates
  FROM projects p
  JOIN biz_models bm ON p.biz_model_id = bm.id
  WHERE p.id = $1
`, [projectId]);

const categoryRates = bizModelRes.rows[0].category_rates;
const categories = categoryRates.categories; // Array of category objects
```

#### 1.2 Fetch Milestone with Dynamic Percentages
```javascript
// OLD: SELECT woodwork_percentage, misc_percentage, shopping_percentage
// NEW:
const milestoneRes = await query(`
  SELECT milestone_code, milestone_name, category_percentages
  FROM biz_model_milestones
  WHERE id = $1
`, [milestoneId]);

const milestone = milestoneRes.rows[0];
const categoryPercentages = milestone.category_percentages; // {"woodwork": 30, "misc": 50, ...}
```

#### 1.3 Fetch Estimation with Dynamic Category Breakdown
```javascript
// OLD: SELECT woodwork_value, misc_internal_value, misc_external_value, shopping_service_value
// NEW:
const estRes = await query(`
  SELECT id, category_breakdown, final_value
  FROM project_estimations
  WHERE project_id = $1
  ORDER BY created_at DESC
  LIMIT 1
`, [projectId]);

const categoryBreakdown = estRes.rows[0].category_breakdown;
// Structure: {"woodwork": {total: 100000}, "misc": {total: 50000}, "shopping": {total: 75000}}
```

#### 1.4 Calculate Targets Dynamically
```javascript
const categoryCalculations = {};

categories.forEach(category => {
  const categoryId = category.id;
  const categoryTotal = categoryBreakdown[categoryId]?.total || 0;
  const categoryPercentage = categoryPercentages[categoryId] || 0;
  const targetAmount = (categoryTotal * categoryPercentage) / 100;

  categoryCalculations[categoryId] = {
    category_name: category.category_name,
    total: categoryTotal,
    target_percentage: categoryPercentage,
    target_amount: targetAmount
  };
});

const targetTotal = Object.values(categoryCalculations).reduce((sum, cat) => sum + cat.target_amount, 0);
```

#### 1.5 Return Dynamic Response
```javascript
return NextResponse.json({
  milestone_code: milestone.milestone_code,
  milestone_name: milestone.milestone_name,
  categories: categoryCalculations, // Dynamic object with all categories
  target_total: targetTotal,
  collected_total: collectedTotal,
  expected_total: remainingTotal
});

// Example response:
{
  "categories": {
    "woodwork": {
      "category_name": "Woodwork",
      "total": 100000,
      "target_percentage": 30,
      "target_amount": 30000
    },
    "misc": {
      "category_name": "Misc",
      "total": 50000,
      "target_percentage": 50,
      "target_amount": 25000
    },
    "shopping": {
      "category_name": "Shopping",
      "total": 75000,
      "target_percentage": 100,
      "target_amount": 75000
    }
  },
  "target_total": 130000,
  "collected_total": 50000,
  "expected_total": 80000
}
```

---

### Phase 2: Update Customer Payments UI

#### 2.1 Milestone Dropdown - Display Dynamic Percentages
```javascript
// OLD (Line 303):
{milestone.milestone_name} - W:${milestone.woodwork_percentage}% M:${milestone.misc_percentage}%

// NEW:
{milestone.milestone_name} - {Object.entries(milestone.category_percentages || {})
  .map(([catId, pct]) => `${catId.toUpperCase()}: ${pct}%`)
  .join(', ')}
```

#### 2.2 Payment Calculation Display - Dynamic Categories
```javascript
// OLD (Line 170-173):
const woodworkAmt = data.target_woodwork_amount?.toFixed(2) || 0;
const miscAmt = data.target_misc_amount?.toFixed(2) || 0;

// NEW:
setPaymentData(prev => ({
  ...prev,
  milestone_id: milestoneId,
  amount: data.expected_total.toFixed(2),
  expected_amount: data.expected_total,
  calculation: data // Contains categories object
}));
```

#### 2.3 Payment Breakdown Display - Dynamic Rendering
```javascript
// OLD (Line 316-346): Hardcoded Woodwork, Misc, Shopping sections

// NEW:
{paymentData.calculation && paymentData.calculation.categories && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
    {Object.entries(paymentData.calculation.categories)
      .filter(([catId, catData]) => catData.target_amount > 0)
      .sort((a, b) => (a[1].sort_order || 0) - (b[1].sort_order || 0))
      .map(([categoryId, categoryData]) => (
        <div key={categoryId} className="border-b border-blue-200 pb-2">
          <p className="text-xs font-semibold text-green-800 mb-1">
            {getCategoryIcon(categoryId)} {categoryData.category_name}:
          </p>
          <div className="text-xs text-green-700 space-y-1 ml-3">
            <div>Total Value: ₹{parseFloat(categoryData.total).toLocaleString('en-IN')}</div>
            <div>Target: {categoryData.target_percentage.toFixed(1)}% → ₹{categoryData.target_amount.toLocaleString('en-IN')}</div>
          </div>
        </div>
      ))}
    
    <div className="pt-2 border-t border-green-300">
      <p className="text-sm font-bold text-green-900">
        💰 Total Expected: ₹{paymentData.calculation.expected_total.toLocaleString('en-IN')}
      </p>
    </div>
  </div>
)}
```

#### 2.4 Helper Function for Category Icons
```javascript
const getCategoryIcon = (categoryId) => {
  const iconMap = {
    'woodwork': '🪵',
    'misc': '🔧',
    'shopping': '🛒',
    'civil': '🏗️',
    'default': '📦'
  };
  return iconMap[categoryId] || iconMap['default'];
};
```

---

## Data Flow Diagram

```
User selects milestone → API call to calculate-payment
                              ↓
                    1. Fetch BizModel category_rates (defines all categories)
                              ↓
                    2. Fetch Milestone category_percentages (% for each category)
                              ↓
                    3. Fetch Estimation category_breakdown (totals per category)
                              ↓
                    4. Calculate target amounts dynamically
                              ↓
                    5. Return {categories: {catId: {data}}, target_total, ...}
                              ↓
                    Frontend receives dynamic response
                              ↓
                    6. Display breakdown for ALL categories (not just 3)
```

---

## Backward Compatibility

### Handling Old Data (If Any)
If any old estimations still have `woodwork_value`, `misc_internal_value`, etc.:
```javascript
// Fallback logic in calculate-payment API
if (!categoryBreakdown || Object.keys(categoryBreakdown).length === 0) {
  // Use old columns
  categoryBreakdown = {
    'woodwork': { total: estimation.woodwork_value || 0 },
    'misc': { total: (estimation.misc_internal_value || 0) + (estimation.misc_external_value || 0) },
    'shopping': { total: estimation.shopping_service_value || 0 }
  };
}
```

---

## Testing Checklist

### Backend API Testing
- [ ] Create project with 3 categories (woodwork, misc, shopping)
- [ ] Create project with 4 categories (add civil)
- [ ] Test calculate-payment API with milestone having category_percentages
- [ ] Verify response contains dynamic `categories` object
- [ ] Test with 0% for some categories
- [ ] Test with 100% for all categories

### Frontend UI Testing
- [ ] Verify milestone dropdown shows dynamic percentages
- [ ] Verify payment calculation displays all N categories
- [ ] Verify no hardcoded category labels
- [ ] Test with 3 categories
- [ ] Test with 4+ categories
- [ ] Verify icons display correctly
- [ ] Verify total calculations are accurate

---

## Files to Modify
1. `/app/app/api/projects/[id]/calculate-payment/route.js` - **Major refactor**
2. `/app/app/projects/[id]/customer-payments/page.js` - **UI update**

---

## Estimated Impact
- **Breaking Changes**: None (new JSONB structure is compatible)
- **Complexity**: Medium (requires dynamic rendering logic)
- **Risk**: Low (well-defined data structures)
- **Testing Required**: High (payment calculations are critical)

---

## Next Steps
1. Get user confirmation on approach
2. Implement calculate-payment API changes
3. Test API thoroughly
4. Update customer-payments UI
5. Test end-to-end flow
6. Update test_result.md with new test cases
