# Purchase Request Component Breakdown - Implementation Approach

## Database Schema Design

### purchase_request_items (Updated)
```sql
CREATE TABLE purchase_request_items (
    id SERIAL PRIMARY KEY,
    purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id),
    estimation_item_id INTEGER NOT NULL REFERENCES estimation_items(id),
    
    -- Item details (user can override/customize)
    item_name TEXT NOT NULL,              -- Can differ from estimation_item.item_name
    item_description TEXT,                -- User-defined description
    category VARCHAR(100),                -- Inherited from estimation
    room_name VARCHAR(255),               -- Inherited from estimation
    
    -- Quantity tracking
    quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    
    -- Delivery tracking
    received_quantity NUMERIC(10,2) DEFAULT 0,
    pending_quantity NUMERIC(10,2),
    
    -- Component metadata
    is_component BOOLEAN DEFAULT false,   -- Is this a breakdown component?
    notes TEXT,                           -- Additional notes for vendor
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Changes:**
- ✅ `item_name` becomes user-editable (not just snapshot)
- ✅ `item_description` for component details
- ✅ `is_component` flag to identify breakdowns
- ✅ Remove UNIQUE constraint entirely (same item can appear multiple times)

## UI Flow Design

### Create PR - Step 1: Select & Configure Items

**Interface Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Category: Woodwork                                              │
├─────────────────────────────────────────────────────────────────┤
│ Estimation Item: TV Unit - 1 no                                │
│                                                                 │
│ Option 1: Use As-Is                                            │
│ ○ Add to PR: Quantity [1] no                                   │
│                                                                 │
│ Option 2: Break Down into Components                           │
│ ● Components:                                                   │
│                                                                 │
│   Component 1:                                                  │
│   ├─ Name: [TV Base Unit____________]                         │
│   ├─ Quantity: [1] no                                          │
│   └─ Description: [Base cabinet with storage drawers______]   │
│                                                                 │
│   Component 2:                                                  │
│   ├─ Name: [TV Wall Unit____________]                         │
│   ├─ Quantity: [1] no                                          │
│   └─ Description: [Wall-mounted shelving unit_____________]   │
│                                                                 │
│   [+ Add Another Component]                                     │
│                                                                 │
│ ☑ Include this item in PR                                      │
└─────────────────────────────────────────────────────────────────┘
```

### UI States

**State 1: Collapsed (Default)**
```
[ ] TV Unit - 1 no (Living Room)
    Original Est: ₹50,000 | Available: 1 no
    [Configure ▼]
```

**State 2: Expanded - Simple Mode**
```
[✓] TV Unit - 1 no (Living Room)
    ○ Use as-is: Quantity [1] no
    ○ Break down into components [Expand ▼]
    [Configure ▲]
```

**State 3: Expanded - Component Mode**
```
[✓] TV Unit - 1 no (Living Room)
    ○ Use as-is
    ● Break down into components [Collapse ▲]
    
    Components (2):
    1. TV Base Unit - 1 no [Edit] [Remove]
    2. TV Wall Unit - 1 no [Edit] [Remove]
    [+ Add Component]
```

## Implementation Details

### 1. API Changes

**A. Available Items API** - No change needed
- Returns estimation items with quantities
- No component logic here

**B. Create PR API** - Accept flexible item structure

**Request Body:**
```json
{
  "vendor_id": 5,
  "items": [
    // Simple item (use as-is)
    {
      "estimation_item_id": 123,
      "item_name": "Wardrobe",      // Same as estimation
      "quantity": 60,
      "unit": "sqft",
      "is_component": false
    },
    
    // Component breakdown (single estimation → multiple PR items)
    {
      "estimation_item_id": 456,
      "item_name": "TV Base Unit",   // Different from estimation
      "item_description": "Base cabinet with storage",
      "quantity": 1,
      "unit": "no",
      "is_component": true
    },
    {
      "estimation_item_id": 456,     // Same parent
      "item_name": "TV Wall Unit",   // Different component
      "item_description": "Wall-mounted shelves",
      "quantity": 1,
      "unit": "no",
      "is_component": true
    }
  ],
  "expected_delivery_date": "2025-02-15",
  "remarks": "Urgent requirement"
}
```

**Validations:**
- ✅ Quantity > 0
- ✅ Item name not empty
- ❌ No sum validation (allow flexibility)
- ✅ Same estimation_item_id can appear multiple times

### 2. Frontend Component Structure

```jsx
// ItemSelectionCard.jsx
const ItemSelectionCard = ({ estimationItem }) => {
  const [mode, setMode] = useState('simple'); // 'simple' | 'components'
  const [isSelected, setIsSelected] = useState(false);
  const [simpleQty, setSimpleQty] = useState(estimationItem.quantity);
  const [components, setComponents] = useState([
    { name: '', quantity: '', description: '' }
  ]);

  const handleAddComponent = () => {
    setComponents([...components, { name: '', quantity: '', description: '' }]);
  };

  const handleRemoveComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  // When submitting:
  const getSubmitData = () => {
    if (mode === 'simple') {
      return [{
        estimation_item_id: estimationItem.id,
        item_name: estimationItem.item_name,
        quantity: simpleQty,
        unit: estimationItem.unit,
        is_component: false
      }];
    } else {
      return components.map(comp => ({
        estimation_item_id: estimationItem.id,
        item_name: comp.name,
        item_description: comp.description,
        quantity: comp.quantity,
        unit: estimationItem.unit,
        is_component: true,
        category: estimationItem.category,
        room_name: estimationItem.room_name
      }));
    }
  };
};
```

### 3. View PR Page Changes

**Grouped Display:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Estimation Reference: TV Unit (1 no)                            │
├─────────────────────────────────────────────────────────────────┤
│ PR Items (Breakdown):                                           │
│ 1. TV Base Unit - 1 no                                         │
│    Base cabinet with storage drawers                            │
│                                                                 │
│ 2. TV Wall Unit - 1 no                                         │
│    Wall-mounted shelving unit                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Table View:**
```
┌──────────────────────────────────────────────────────────────────┐
│ Est. Item    │ PR Item Name    │ Qty │ Unit │ Component? │ Notes │
├──────────────────────────────────────────────────────────────────┤
│ TV Unit      │ TV Base Unit    │ 1   │ no   │ ✓         │ Base  │
│ TV Unit      │ TV Wall Unit    │ 1   │ no   │ ✓         │ Wall  │
│ Wardrobe     │ Wardrobe        │ 60  │ sqft │ ✗         │ -     │
└──────────────────────────────────────────────────────────────────┘
```

### 4. Benefits

✅ **Maximum Flexibility**: Users define what they need
✅ **Vendor Specialization**: Different vendors for different components
✅ **Detailed Specifications**: Each component has its own description
✅ **Phased Procurement**: Order base now, wall unit later
✅ **Cost Optimization**: Compare prices at component level
✅ **Better Communication**: Clear item names for vendors

### 5. Validation Strategy

**What to validate:**
- ✅ Quantity > 0
- ✅ Item name not empty
- ✅ At least one item in PR

**What NOT to validate:**
- ❌ Sum of quantities = estimation quantity (too restrictive)
- ❌ Unique item names (allow duplicates)
- ❌ Component count limits

**Why no strict validation?**
- User might order extra (buffer)
- User might order less (phased)
- User might order different specs
- Trust user's domain knowledge

### 6. Edge Cases

**Case 1: Same item, different vendors**
```
Estimation: Wardrobe - 5 no
PR-001 (Vendor A): Wardrobe - 3 no
PR-002 (Vendor B): Wardrobe - 2 no
```

**Case 2: Mix of simple + components**
```
Estimation: Bedroom Set - 2 sets
PR-001:
  - Bedroom Set - 1 set (simple, full set from Vendor A)
  - Bed Frame - 1 no (component of set 2, Vendor B)
  - Mattress - 1 no (component of set 2, Vendor C)
```

**Case 3: Over-ordering**
```
Estimation: Tiles - 100 sqft
PR-001: Tiles - 110 sqft (10% buffer)
```

## Migration Plan

### Phase 1: Schema Update (Already done in 012)
- ✅ Remove pricing columns
- ⏳ Add is_component, item_description
- ⏳ Remove unique constraint
- ⏳ Make item_name user-editable

### Phase 2: API Updates
- Update create PR endpoint
- Update view PR endpoint
- Update available items calculation

### Phase 3: UI Updates
- Component breakdown interface
- Collapsible item cards
- Dynamic component addition
- Validation & error handling

### Phase 4: Testing
- Simple quantity split
- Component breakdown
- Mixed scenarios
- Edge cases

## Recommendation

**Option A: Full Component Support (Recommended)**
- Implement component breakdown UI
- Allow item name editing
- Add description field
- Maximum flexibility

**Option B: Simple Quantity Split Only**
- Just quantity inputs
- No component breakdown
- Faster to implement
- Less flexible

**Suggested: Option A** - Provides complete solution for real-world procurement needs.

---

**Ready to proceed with Option A implementation?**
