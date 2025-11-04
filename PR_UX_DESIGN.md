# Purchase Request UX Design - Best Practices

## User's Proposed Flow
```
Step 1: Select Vendor
Step 2: Choose Fulfillment Mode (Full vs Components)
Step 3: Summary & Save
```

## Enhanced UX Flow (Recommended)

### Option A: Vendor-First Flow (User's Suggestion)
```
Step 1: Select Vendor
  ├─ Dropdown with vendor list
  └─ Shows vendor details (contact, type)

Step 2: Select Items & Fulfillment Mode
  ├─ Show available estimation items
  ├─ For each item, choose mode:
  │  ├─ ○ Full Item (auto weightage 1.0)
  │  └─ ○ Components (custom breakdown)
  └─ If Components: Open modal/panel to add components

Step 3: Review & Save
  ├─ Summary of all items/components
  ├─ Fulfillment calculation
  └─ Confirm & Create PR
```

**Pros:**
- Clear vendor context upfront
- Simpler mental model
- Good for dedicated vendor orders

**Cons:**
- Can't see items before vendor selection
- Can't mix vendors (need multiple PRs)

---

### Option B: Items-First Flow (Alternative - Better UX)
```
Step 1: Select Items & Configure
  ├─ Show all available estimation items
  ├─ Quick actions per item:
  │  ├─ [Add Full] - One click, auto weightage 1.0
  │  └─ [Breakdown] - Open component editor
  └─ Visual cart with selected items

Step 2: Vendor & Details
  ├─ Select vendor from dropdown
  ├─ Expected delivery, notes
  └─ Can see what items will go to this vendor

Step 3: Review & Create
  ├─ Full summary with fulfillment %
  ├─ Edit if needed
  └─ Confirm creation
```

**Pros:**
- See available items first (better context)
- Mix full + component items in same PR
- Faster for power users (quick add)
- Better visual feedback

**Cons:**
- Vendor selection at end (might forget context)

---

### Option C: Smart Hybrid (RECOMMENDED - Best UX)
```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Select Vendor & Review Available Items              │
├──────────────────────────────────────────────────────────────┤
│ Vendor: [Select Vendor ▼]  [Show All Items]                │
│                                                              │
│ Available Items (5):                                         │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ TV Unit - 3 no (Living Room)                          │ │
│ │ Available: 3.0 | In PRs: 0.0                          │ │
│ │ [✓ Add Full (1.0)] [⊕ Breakdown into Components]     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Cart (0 items) →                                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Step 2: Configure Selected Items                            │
├──────────────────────────────────────────────────────────────┤
│ Selected for PR: 3 items                                     │
│                                                              │
│ 1. TV Unit (Full) ✓                                         │
│    Qty: 1 no | Weightage: 1.0                              │
│    [Edit] [Remove]                                           │
│                                                              │
│ 2. TV Unit (Component: Base)                                │
│    Qty: 2 no | Weightage: 0.5                              │
│    [Edit] [Remove]                                           │
│                                                              │
│ 3. TV Unit (Component: Wall)                                │
│    Qty: 2 no | Weightage: 0.5                              │
│    [Edit] [Remove]                                           │
│                                                              │
│ Fulfillment: TV Unit → 3.0 / 3.0 (100%) ✓                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Step 3: Review & Create                                      │
├──────────────────────────────────────────────────────────────┤
│ PR Details:                                                  │
│ Vendor: ABC Suppliers                                        │
│ Items: 3 items                                               │
│ Expected Delivery: [Date]                                    │
│ Notes: [...]                                                 │
│                                                              │
│ [← Back] [Create Purchase Request]                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Detailed Feature Breakdown

### 1. Quick Add vs Breakdown

**Quick Add Button:**
- One-click action
- Creates PR item with same name as estimation item
- Auto sets weightage to 1.0
- Quantity input: defaults to available quantity

**Breakdown Button:**
- Opens side panel/modal
- Shows estimation item details at top
- Form to add multiple components
- Real-time fulfillment calculation

### 2. Component Breakdown Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Break Down: TV Unit (3 no available)                           │
├─────────────────────────────────────────────────────────────────┤
│ Add Components:                                                 │
│                                                                 │
│ Component 1:                                                    │
│ ├─ Name: [Full TV Unit_____________]                          │
│ ├─ Quantity: [1___] no                                         │
│ ├─ Weightage: [1.0] (per unit)                                │
│ ├─ Total Fulfillment: 1.0 × 1 = 1.0                           │
│ └─ Notes: [Complete assembled unit_________] [×]              │
│                                                                 │
│ Component 2:                                                    │
│ ├─ Name: [TV Base Unit_____________]                          │
│ ├─ Quantity: [2___] no                                         │
│ ├─ Weightage: [0.5] (per unit)                                │
│ ├─ Total Fulfillment: 0.5 × 2 = 1.0                           │
│ └─ Notes: [Base cabinet only______________] [×]               │
│                                                                 │
│ [+ Add Another Component]                                       │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Fulfillment Summary:                                      │ │
│ │ Total Required: 3.0 no                                    │ │
│ │ Components Fulfill: 2.0 no (66.7%)                       │ │
│ │ Remaining: 1.0 no                                         │ │
│ │ Status: ⚠️ Partial fulfillment                           │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Cancel] [Add to PR]                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Visual Indicators

**Fulfillment Status Colors:**
- 🟢 Green: 90-100% fulfilled
- 🟡 Yellow: 50-89% fulfilled
- 🔴 Red: <50% fulfilled
- ⚪ Gray: 0% (not started)

**Item Card States:**
```
┌─────────────────────────────────────────────────────┐
│ TV Unit - 3 no                              [Full]  │
│ ████████████████░░░░ 80% fulfilled                 │
│ Available: 0.6 no | In Cart: 2.4 no                │
└─────────────────────────────────────────────────────┘
```

### 4. Smart Defaults

**Auto-fill Scenarios:**

**Scenario 1: First component**
- Name: Same as estimation item
- Quantity: Total available
- Weightage: 1.0

**Scenario 2: Additional components**
- Name: Empty (user must fill)
- Quantity: Remaining unfulfilled
- Weightage: Calculate from remaining (smart suggestion)

**Example:**
```
Est: TV Unit - 3 no
Component 1: Full Unit - 1 no @ 1.0 = 1.0
[+ Add Component] → Auto suggests:
  - Quantity: 2 no (remaining)
  - Weightage: 1.0 (if equal split) or custom
```

### 5. Validation & Error Handling

**Real-time Validations:**
✅ Weightage > 0 and <= 1.0
✅ Quantity > 0
✅ Name not empty
✅ At least one item in PR

**Warnings (not blocking):**
⚠️ Fulfillment != 100% (can over/under fulfill)
⚠️ No vendor selected
⚠️ No delivery date

**Errors (blocking):**
❌ PR item name empty
❌ Quantity = 0 or invalid
❌ Weightage outside 0-1 range

### 6. Advanced Features

**A. Templates/Presets:**
```
Common Breakdowns:
├─ 50-50 Split: 2 components @ 0.5 each
├─ 30-70 Split: 2 components @ 0.3 and 0.7
└─ Custom: User defined
```

**B. Duplicate/Clone:**
- "Copy to new PR" button
- Keeps items, changes vendor

**C. Bulk Actions:**
- Select multiple items
- Apply same mode (all full or all breakdown)

**D. Fulfillment Progress:**
```
Overall Progress:
█████████░░░░░░░ 60% (6 of 10 items configured)
```

---

## Final Recommended Flow

### ⭐ Best UX: Smart 3-Step Flow

**Step 1: Vendor & Item Selection**
- Select vendor first (can change later)
- Grid/table of available items
- Quick actions: "Add Full" or "Breakdown"
- Visual cart showing selections
- Real-time fulfillment tracking

**Step 2: Configure Cart Items**
- Review all selected items
- Edit any component breakdowns
- Inline editing (no modal re-opens)
- Drag to reorder
- Remove unwanted items

**Step 3: Finalize**
- Vendor confirmation (can change)
- Delivery details
- Notes
- Summary with fulfillment %
- Create button

---

## UX Principles Applied

1. **Progressive Disclosure**: Show complexity only when needed
2. **Feedback**: Real-time validation and calculations
3. **Flexibility**: Mix full + component items
4. **Speed**: Quick path for common cases
5. **Safety**: Clear warnings, easy undo
6. **Clarity**: Visual fulfillment indicators
7. **Error Prevention**: Smart defaults, inline validation

---

## Implementation Priority

### Phase 1 (MVP - Week 1):
✅ Vendor selection
✅ Item listing
✅ Quick add (full mode)
✅ Basic component breakdown
✅ Fulfillment calculation
✅ Create PR

### Phase 2 (Enhanced - Week 2):
✅ Visual progress bars
✅ Advanced component editor
✅ Templates/presets
✅ Bulk actions
✅ Better mobile responsive

### Phase 3 (Polish - Week 3):
✅ Drag-drop reordering
✅ Keyboard shortcuts
✅ Undo/redo
✅ Save as draft
✅ Export to CSV

---

## Mobile Considerations

**Responsive Design:**
- Stack components vertically
- Swipe actions for quick add
- Bottom sheet for breakdown
- Sticky header with progress
- Large touch targets

---

## Accessibility

✅ Keyboard navigation
✅ Screen reader support
✅ Color contrast (WCAG AA)
✅ Focus indicators
✅ Error announcements

---

## Conclusion

**Recommended Flow: Smart Hybrid**
- Balances speed and flexibility
- Visual feedback at every step
- Mix of quick + detailed workflows
- Scales for simple to complex scenarios

**Key Differentiators:**
1. 🎯 Quick Add for speed
2. 🎨 Visual fulfillment tracking
3. 🧩 Flexible component breakdown
4. ✅ Real-time validation
5. 📊 Progress indicators

This design will make PR creation intuitive, fast, and error-free!
