# Analysis: Refactor Manage-Estimation to Display Items by Category

## Current State

### `/app/projects/[id]/manage-estimation/page.js` (Current - Editable)
- **Single TanStack Table** with ALL items from all categories
- **Inline editing** for all fields
- **Virtual scrolling** with 3-pane layout (left-fixed, middle-scrollable, right-fixed)
- **Single form submit** for all items at once
- **EstimationSummary** component at bottom showing category breakdown
- **State**: Single `data` array containing all estimation items

### `/app/projects/[id]/page.js` (Reference - Read-only)
- **Multiple tables** - one per category (lines 225-233)
- Uses **EstimationItemsTable** component for each category
- **Filters** items by category: `estimationItems.filter((item) => item.category === category.id)`
- **Read-only display** - no editing
- Each table has its own **category-specific totals** in footer

---

## Proposed Refactor

### Goal
Transform manage-estimation page to display **separate editable tables per category**, similar to project details page structure, while maintaining **single form submit**.

---

## Architecture Design

### 1. Component Structure

```
<form onSubmit={handleSubmit}>
  
  {/* Overall Summary (Optional - Top) */}
  <OverallSummary totals={calculateTotals()} />
  
  {/* Category Tables */}
  {baseRates.category_rates?.categories
    ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(category => {
      const categoryItems = data.filter(item => item.category === category.id);
      return (
        <CategoryEstimationTable
          key={category.id}
          category={category}
          items={categoryItems}
          onItemsChange={(updatedItems) => updateCategoryItems(category.id, updatedItems)}
          baseRates={baseRates}
          calculateItemTotal={calculateItemTotal}
        />
      );
    })}
  
  {/* Overall Summary (Optional - Bottom) */}
  <OverallSummary totals={calculateTotals()} />
  
  {/* Form Controls */}
  <Card>
    <CardContent>
      <Textarea name="remarks" />
      <Select name="status" />
      <Button type="submit">Save Estimation</Button>
    </CardContent>
  </Card>
</form>
```

---

### 2. Data Management Strategy

#### Current:
```javascript
const [data, setData] = useState([all items from all categories]);
```

#### Proposed (Option A - Keep Single Array):
```javascript
// Keep single data array, but filter per category
const [data, setData] = useState([all items]);

const updateCategoryItems = (categoryId, updatedItems) => {
  setData(prevData => {
    // Remove old items from this category
    const otherItems = prevData.filter(item => item.category !== categoryId);
    // Add updated items from this category
    return [...otherItems, ...updatedItems];
  });
};
```

**Pros:**
- ✅ Single source of truth
- ✅ Easy to submit (just send entire data array)
- ✅ Calculations work as-is

**Cons:**
- ⚠️ Need careful state management when updating

#### Proposed (Option B - Separate State per Category):
```javascript
const [dataByCategory, setDataByCategory] = useState({
  woodwork: [...],
  misc: [...],
  shopping: [...]
});

// Flatten for submission
const getAllItems = () => Object.values(dataByCategory).flat();
```

**Pros:**
- ✅ Cleaner separation
- ✅ Easier to update individual categories

**Cons:**
- ❌ More complex state management
- ❌ Need to flatten for calculations and submission

**Recommendation:** **Option A** - Keep single array, filter per category

---

### 3. Component Design: CategoryEstimationTable

```javascript
const CategoryEstimationTable = memo(({ 
  category, 
  items, 
  onItemsChange,
  baseRates,
  calculateItemTotal 
}) => {
  
  // Local state for this category's items
  const [localItems, setLocalItems] = useState(items);
  
  // Sync with parent when items change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);
  
  // Calculate category-specific totals
  const categoryTotals = useMemo(() => {
    const fields = ['subtotal', 'item_discount_amount', 'karighar_charges_amount', 
                    'discount_kg_charges_amount', 'gst_amount', 'item_total'];
    const sums = {};
    fields.forEach(field => {
      sums[field] = localItems.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
    });
    return sums;
  }, [localItems]);
  
  // TanStack Table setup
  const table = useReactTable({
    data: localItems,
    columns: categoryColumns, // Similar to current columns
    getCoreRowModel: getCoreRowModel(),
    // ... other config
  });
  
  // Add new item for this category
  const addItem = () => {
    const newItem = { ...emptyItem, category: category.id };
    const updated = [...localItems, newItem];
    setLocalItems(updated);
    onItemsChange(updated);
  };
  
  // Update item
  const updateItem = (index, field, value) => {
    const updated = [...localItems];
    updated[index][field] = value;
    setLocalItems(updated);
    onItemsChange(updated);
  };
  
  // Remove item
  const removeItem = (index) => {
    const updated = localItems.filter((_, i) => i !== index);
    setLocalItems(updated);
    onItemsChange(updated);
  };
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getCategoryIcon(category.id)} {category.category_name}
        </CardTitle>
        <CardDescription>
          KG Label: {category.kg_label} | KG %: {category.kg_percentage}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Editable Table (similar to current EditableEstimationItems) */}
        <EditableTable 
          data={localItems}
          onUpdate={updateItem}
          onRemove={removeItem}
          onAdd={addItem}
          baseRates={baseRates}
          category={category}
        />
        
        {/* Category Summary Footer */}
        <CategorySummary totals={categoryTotals} category={category} />
      </CardContent>
    </Card>
  );
});
```

---

### 4. Table Implementation Options

#### Option A: Simplify - Remove Virtual Scrolling
**For category-based tables:**
- Each category likely has fewer items (10-50 items per category)
- Virtual scrolling may not be needed
- Simpler implementation without 3-pane layout

**Pros:**
- ✅ Simpler code
- ✅ Easier to maintain
- ✅ Better visual separation per category

**Cons:**
- ⚠️ May have performance issues if one category has 200+ items

#### Option B: Keep Virtual Scrolling per Category
**Keep current EditableEstimationItems structure but per category:**
- 3-pane layout (left-fixed, middle-scrollable, right-fixed)
- Virtual scrolling per category table

**Pros:**
- ✅ Handles large item counts per category
- ✅ Consistent with current implementation

**Cons:**
- ❌ More complex
- ❌ Each category takes vertical space even with few items

**Recommendation:** **Option A** - Simplify without virtual scrolling
- Most categories will have <100 items
- Better UX with visual separation
- If performance becomes an issue, can add virtual scrolling later

---

### 5. Form Submission Flow

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setSaving(true);
  
  // Data is already in correct format (single array)
  // Each CategoryEstimationTable updates the main data array via onItemsChange
  
  const totals = calculateTotals(); // Works on entire data array
  
  // Validation
  if (data.length === 0) {
    toast.error('Add at least one item');
    return;
  }
  
  // Same submission logic as current
  const payload = {
    project_id: projectId,
    category_breakdown: totals.category_breakdown,
    items_value: totals.items_value,
    // ... rest of totals
    remarks: formData.remarks,
    status: formData.status,
    items: data.map(item => ({
      // ... map fields
    }))
  };
  
  // Submit to API
  // ...
};
```

**Key Point:** Submission logic remains **unchanged** because we maintain single data array.

---

### 6. Empty State Handling

```javascript
// For categories with no items
{categoryItems.length === 0 ? (
  <div className="text-center py-8 bg-slate-50 rounded-lg">
    <p className="text-muted-foreground mb-3">
      No items in {category.category_name} yet
    </p>
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => addItemForCategory(category.id)}
    >
      <Plus className="h-4 w-4 mr-2" />
      Add {category.category_name} Item
    </Button>
  </div>
) : (
  <CategoryEstimationTable ... />
)}
```

---

### 7. Overall Summary Component

```javascript
const OverallSummary = ({ totals }) => {
  const categories = baseRates.category_rates?.categories || [];
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Estimation Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Category Breakdown */}
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          {categories
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(category => (
              <div key={category.id} className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">{category.category_name}</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totals.category_breakdown?.[category.id]?.total || 0)}
                </p>
              </div>
            ))}
        </div>
        
        {/* High-Level Totals */}
        <div className="grid md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Total Items Value</p>
            <p className="text-xl font-bold">{formatCurrency(totals.items_value)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Discount</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(totals.items_discount + totals.kg_charges_discount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">GST</p>
            <p className="text-xl font-bold">{formatCurrency(totals.gst_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Final Value</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totals.final_value)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Placement:** User preference - top or bottom
- **Top:** Overview before details (recommended)
- **Bottom:** Summary after all details

---

## Implementation Steps

### Phase 1: Create Components
1. Create `CategoryEstimationTable` component
2. Create `CategorySummary` component (footer)
3. Create `OverallSummary` component

### Phase 2: Refactor Main Page
1. Update main return to map over categories
2. Filter data by category
3. Implement `updateCategoryItems` function

### Phase 3: Update Table Logic
1. Adapt columns for category-specific table
2. Remove virtual scrolling (or keep if needed)
3. Update add/remove/duplicate functions for category context

### Phase 4: Testing
1. Test with single category
2. Test with multiple categories
3. Test empty categories
4. Test form submission
5. Test calculations

---

## Migration Considerations

### Backward Compatibility
- ✅ API endpoints remain unchanged
- ✅ Data structure for submission unchanged
- ✅ Calculations remain the same

### State Management
- Keep single `data` array
- Filter per category for display
- Update via `updateCategoryItems` helper

### Performance
- Less items per table (divided by categories)
- No virtual scrolling = simpler but need to monitor
- Can add back virtual scrolling if needed

---

## Visual Layout Comparison

### Current:
```
┌─────────────────────────────────────┐
│ Project Estimation                  │
├─────────────────────────────────────┤
│ [ALL ITEMS IN ONE BIG TABLE]        │
│ - Woodwork Item 1                   │
│ - Woodwork Item 2                   │
│ - Misc Item 1                       │
│ - Shopping Item 1                   │
│ - Woodwork Item 3                   │
│ ...                                 │
├─────────────────────────────────────┤
│ Overall Summary                     │
└─────────────────────────────────────┘
```

### Proposed:
```
┌─────────────────────────────────────┐
│ Overall Summary (Optional Top)      │
│ Categories: Wood:100K Misc:50K      │
│ Total: 150K                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🪵 Woodwork                         │
├─────────────────────────────────────┤
│ - Woodwork Item 1                   │
│ - Woodwork Item 2                   │
│ - Woodwork Item 3                   │
├─────────────────────────────────────┤
│ Woodwork Total: ₹100,000            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🔧 Misc                             │
├─────────────────────────────────────┤
│ - Misc Item 1                       │
├─────────────────────────────────────┤
│ Misc Total: ₹50,000                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🛒 Shopping                         │
├─────────────────────────────────────┤
│ - Shopping Item 1                   │
├─────────────────────────────────────┤
│ Shopping Total: ₹75,000             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Overall Summary (Optional Bottom)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Form Controls (Remarks, Status, Submit) │
└─────────────────────────────────────┘
```

---

## Benefits

### User Experience
1. ✅ **Better Organization** - Items grouped by category
2. ✅ **Easier Navigation** - Scroll through categories, not one huge table
3. ✅ **Visual Clarity** - Category headers with icons
4. ✅ **Category Totals** - Immediate feedback per category
5. ✅ **Consistent** - Matches project details page layout

### Technical
1. ✅ **Maintainable** - Smaller, focused components
2. ✅ **Scalable** - Works with N categories
3. ✅ **Performance** - Smaller tables = faster rendering
4. ✅ **Flexible** - Easy to add category-specific features

---

## Risks & Mitigation

### Risk 1: Complex State Management
**Mitigation:** Use single data array with helper functions

### Risk 2: Performance with Many Items
**Mitigation:** Monitor and add virtual scrolling if needed

### Risk 3: Breaking Existing Functionality
**Mitigation:** Keep submission logic unchanged, thorough testing

---

## Recommendation

### Proposed Approach:
1. **Keep single data array** for state management
2. **Create CategoryEstimationTable** component per category
3. **Simplify tables** - remove virtual scrolling initially
4. **Add OverallSummary** at top for quick overview
5. **Single form submit** - no changes to submission logic
6. **Progressive enhancement** - can add features per category later

### Timeline Estimate:
- Phase 1: 2-3 hours (components)
- Phase 2: 2-3 hours (refactor main page)
- Phase 3: 2-3 hours (table logic)
- Phase 4: 2-3 hours (testing)
- **Total: 8-12 hours of work**

---

## Next Steps

1. **Get approval** on approach
2. **Confirm summary placement** (top, bottom, or both?)
3. **Confirm virtual scrolling** (remove or keep?)
4. **Start implementation** with Phase 1

---

## Questions for User

1. Should overall summary be at **top**, **bottom**, or **both**?
2. Do you expect categories to have 100+ items? (decides virtual scrolling)
3. Any specific UI preferences for category cards?
4. Should empty categories show placeholder or be hidden?

