# BizModel Category Rates Implementation

## Overview
Restructured BizModel from flat percentage columns to a flexible JSONB-based category system, allowing users to define unlimited categories with custom pricing rules.

## Changes Summary

### 1. Database Schema Changes

**Table: `biz_models`**

**Removed Columns:**
- `service_charge_percentage`
- `max_service_charge_discount_percentage`
- `design_charge_percentage`
- `max_design_charge_discount_percentage`
- `shopping_charge_percentage`
- `max_shopping_charge_discount_percentage`

**Added Columns:**
- `category_rates` (JSONB) - Stores all category configurations
- `gst_percentage` (NUMERIC) - Moved from previous structure, default 18%

**JSONB Structure (`category_rates`):**
```json
{
  "categories": [
    {
      "id": "woodwork",
      "category_name": "Woodwork",
      "kg_label": "Design and Consultation",
      "max_item_discount_percentage": 20,
      "kg_percentage": 10,
      "max_kg_discount_percentage": 50
    },
    {
      "id": "misc",
      "category_name": "Misc",
      "kg_label": "Service Charges",
      "max_item_discount_percentage": 20,
      "kg_percentage": 8,
      "max_kg_discount_percentage": 40
    },
    {
      "id": "shopping",
      "category_name": "Shopping",
      "kg_label": "Shopping Service Charges",
      "max_item_discount_percentage": 20,
      "kg_percentage": 5,
      "max_kg_discount_percentage": 30
    }
  ]
}
```

**Field Definitions:**
- `id`: Unique identifier for the category (lowercase, no spaces)
- `category_name`: Display name for the category (user-editable)
- `kg_label`: Custom label for KG charges column (e.g., "Design & Consultation")
- `max_item_discount_percentage`: Maximum discount % allowed on item base price
- `kg_percentage`: Default KG service charge % applied on discounted item price
- `max_kg_discount_percentage`: Maximum discount % allowed on KG charges

### 2. Migration Script

**File:** `/app/migrate_bizmodel_to_categories.sql`

- Adds `category_rates` JSONB column to existing table
- Migrates existing BizModel data from flat columns to JSONB structure
- Maps old columns to new category structure:
  - `design_charge_percentage` → Woodwork category's `kg_percentage`
  - `service_charge_percentage` → Misc category's `kg_percentage`
  - `shopping_charge_percentage` → Shopping category's `kg_percentage`
- Preserves all existing discount percentages
- Sets default `max_item_discount_percentage` to 20% for all categories

**Note:** Old columns are commented out for now. Uncomment DROP statements after verifying migration.

### 3. API Changes

**File: `/app/app/api/biz-models/route.js`**
- **POST**: Now accepts `category_rates` JSONB instead of flat percentage columns
- Added validation for JSONB structure
- Stores categories as JSON string

**File: `/app/app/api/biz-models/[id]/route.js`**
- **GET**: Returns `category_rates` JSONB from database
- **PUT**: Updates `category_rates` with validation
- Removed flat percentage column handling

### 4. UI Changes

**File: `/app/app/settings/bizmodels/page.js`**

**Create/Edit Form:**
- Added new "Categories & Rates" tab (4th tab in the dialog)
- Dynamic category builder with Add/Remove functionality
- Each category form includes:
  - Category Name (text)
  - KG Charge Label (text)
  - Max Item Discount % (number)
  - KG Percentage % (number)
  - Max KG Discount % (number)
- Pre-populates with 3 default categories for new models
- Users can add unlimited custom categories
- Delete button for custom categories (minimum 1 required)

**Display/View:**
- Updated "Configuration" tab to show categories from JSONB
- Card-based layout for each category showing all 5 fields
- Color-coded values for easy identification

**State Management:**
- Added `categories` state array
- Added `addCategory()`, `removeCategory()`, `updateCategory()` functions
- Categories are validated and filtered (must have name and label) before saving

### 5. Pricing Calculation Logic

**Per Category Calculation Flow:**

```
1. Item Base Price = Quantity × Unit Price
   Example: 100 sqft × ₹500 = ₹50,000

2. Apply Item Discount (max: max_item_discount_percentage)
   Example: 10% discount → ₹45,000

3. Calculate KG Service Charge
   Service Charge = Discounted Price × kg_percentage
   Example: ₹45,000 × 10% = ₹4,500

4. Apply Service Charge Discount (max: max_kg_discount_percentage)
   Example: 20% discount on ₹4,500 → ₹900 discount
   Final KG Charge = ₹3,600

5. Subtotal = Discounted Item Price + Final KG Charge
   Example: ₹45,000 + ₹3,600 = ₹48,600

6. Apply GST → Final Total
   Example: ₹48,600 × 1.18 = ₹57,348
```

## What's NOT Changed (Yet)

The following are intentionally left unchanged for Phase 2:

1. **`project_base_rates` table** - Still uses old flat column structure
2. **Project Base Rates APIs** - Still work with flat columns
3. **Project Base Rates UI** - Still displays old structure
4. **Estimation calculation logic** - Not yet updated to use new categories
5. **Manage Estimation page** - Still uses hardcoded category logic

## Testing Checklist

- [ ] Create new BizModel with custom categories
- [ ] Edit existing BizModel and verify categories load correctly
- [ ] Add/remove categories dynamically
- [ ] Verify category data saves correctly in database
- [ ] View BizModel details and verify categories display
- [ ] Test with 1 category (minimum)
- [ ] Test with 5+ categories
- [ ] Verify GST percentage is saved and displayed
- [ ] Test published/draft status toggle
- [ ] Verify migration script converted existing data correctly

## Next Steps (Phase 2)

1. Update `project_base_rates` table to use JSONB structure
2. Migrate project base rates data
3. Update Project Base Rates APIs to work with categories
4. Update Project Base Rates UI
5. Update estimation calculation logic to use new category structure
6. Update Manage Estimation page to support dynamic categories
7. Drop old flat columns from both tables after verification

## Files Modified

1. `/app/migrate_bizmodel_to_categories.sql` (NEW)
2. `/app/app/api/biz-models/route.js`
3. `/app/app/api/biz-models/[id]/route.js`
4. `/app/app/settings/bizmodels/page.js`
5. `/app/schema.sql`

## Backward Compatibility

- Existing BizModels are automatically migrated via SQL script
- Old projects continue to work with their existing `project_base_rates`
- New projects will use new BizModel structure
- Phase 2 will handle full migration of all dependent features
