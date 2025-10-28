# Fix: Removed Hardcoded Default Categories

## Issue
Two files still contained hardcoded default categories (woodwork, misc, shopping) that would auto-populate when creating or editing BizModels. This went against the fully dynamic category system.

## Files Fixed

### 1. `/app/app/api/biz-models/[id]/route.js` ✅

**Problem (Lines 159-174):**
```javascript
INSERT INTO biz_model_milestones (
  ..., woodwork_percentage, misc_percentage
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
[..., milestone.woodwork_percentage || 0, milestone.misc_percentage || 0]
```

**Fixed:**
```javascript
INSERT INTO biz_model_milestones (
  ..., category_percentages
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
[..., JSON.stringify(milestone.category_percentages || {})]
```

**Impact:** PUT endpoint now correctly uses dynamic `category_percentages` JSONB instead of flat columns.

---

### 2. `/app/app/settings/bizmodels/page.js` ✅

#### Fix 2A: Initial State (Line 42)
**Problem:**
```javascript
const [categories, setCategories] = useState([
  { id: 'woodwork', category_name: 'Woodwork', ... },
  { id: 'misc', category_name: 'Misc', ... },
  { id: 'shopping', category_name: 'Shopping', ... }
]);
```

**Fixed:**
```javascript
const [categories, setCategories] = useState([]);
```

#### Fix 2B: Reset After Creation (Line 239)
**Problem:**
```javascript
setCategories([
  { id: 'woodwork', ... },
  { id: 'misc', ... },
  { id: 'shopping', ... }
]);
```

**Fixed:**
```javascript
setCategories([]);
```

#### Fix 2C: Edit/Load Fallback (Line 293)
**Problem:**
```javascript
if (data.model.category_rates && data.model.category_rates.categories) {
  setCategories(data.model.category_rates.categories);
} else {
  // Fallback to default categories if not found
  setCategories([
    { id: 'woodwork', ... },
    { id: 'misc', ... },
    { id: 'shopping', ... }
  ]);
}
```

**Fixed:**
```javascript
if (data.model.category_rates && data.model.category_rates.categories) {
  setCategories(data.model.category_rates.categories);
} else {
  // Empty array if no categories defined yet
  setCategories([]);
}
```

---

## Impact

### Before Fix
- Creating a new BizModel → Auto-populated with 3 hardcoded categories
- Editing old BizModel without categories → Auto-populated with 3 defaults
- Updating BizModel → Used old flat column structure in API

### After Fix
- Creating a new BizModel → Starts with empty categories array
- User must explicitly click "Add Category" to add categories
- No assumptions about category names or count
- Full control over category configuration
- API correctly uses dynamic JSONB structure

---

## User Experience

**New BizModel Creation Flow:**
1. User clicks "Create New Business Model"
2. Categories section is empty
3. User clicks "+ Add Category" button
4. User defines category ID, name, rates, etc.
5. Repeat for as many categories as needed
6. No pre-filled defaults

**Benefits:**
✅ No forced categories
✅ Users start with clean slate
✅ Encourages intentional category design
✅ Truly dynamic system
✅ No legacy defaults

---

## Files Modified
1. `/app/app/api/biz-models/[id]/route.js` - PUT endpoint milestone insertion
2. `/app/app/settings/bizmodels/page.js` - 3 locations (initial state, reset, fallback)

---

## Testing Checklist
- [ ] Create new BizModel - verify categories start empty
- [ ] Add custom categories (not woodwork/misc/shopping)
- [ ] Save and verify categories are stored
- [ ] Edit existing BizModel - verify categories load correctly
- [ ] Update BizModel - verify API uses category_percentages
- [ ] Create project from BizModel - verify categories flow through

---

## Status
✅ Complete - All hardcoded category defaults removed

---

## Date
June 15, 2025
