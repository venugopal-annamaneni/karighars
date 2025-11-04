# Purchase Request Architecture Redesign - Implementation Plan

## Schema Comparison

### OLD SCHEMA (Current)
```sql
purchase_requests
- id
- pr_number
- project_id
- vendor_id
- status
- created_by

purchase_request_items
- id
- purchase_request_id
- estimation_item_id  ← Direct link
- item_name
- quantity
- is_component
```

### NEW SCHEMA (Target)
```sql
purchase_requests
- id
- pr_number
- project_id
- estimation_id  ← NEW: Link to parent estimation
- vendor_id
- status (confirmed, cancelled)
- created_at
- created_by

purchase_request_items
- id
- purchase_request_id
- purchase_request_item_name  ← Renamed from item_name
- quantity
- unit  ← NEW: Required
- active  ← NEW: Soft delete flag
- status (confirmed, cancelled)
- (Remove: category, room_name, is_component, notes)

purchase_request_estimation_links  ← NEW TABLE
- id
- estimation_item_id  ← FK to estimation_items
- purchase_request_item_id  ← FK to purchase_request_items
- linked_qty  ← How much of PR item links to this estimation item
- unit_purchase_request_item_weightage  ← Fraction of estimation item fulfilled
- notes
```

## Key Changes Required

### 1. Database Migration

**Migration 013: Restructure Purchase Request Schema**

```sql
BEGIN;

-- Step 1: Create new junction table
CREATE TABLE purchase_request_estimation_links (
    id SERIAL PRIMARY KEY,
    estimation_item_id INTEGER NOT NULL REFERENCES estimation_items(id) ON DELETE CASCADE,
    purchase_request_item_id INTEGER NOT NULL REFERENCES purchase_request_items(id) ON DELETE CASCADE,
    linked_qty NUMERIC(10,2) NOT NULL,
    unit_purchase_request_item_weightage NUMERIC(5,4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prel_estimation ON purchase_request_estimation_links(estimation_item_id);
CREATE INDEX idx_prel_pr_item ON purchase_request_estimation_links(purchase_request_item_id);

COMMENT ON COLUMN purchase_request_estimation_links.linked_qty IS 'Quantity of PR item linked to this estimation item';
COMMENT ON COLUMN purchase_request_estimation_links.unit_purchase_request_item_weightage IS 'Weightage: 1.0 = full item, 0.5 = half, etc. Used to calculate fulfillment.';

-- Step 2: Migrate existing data to new structure
-- (Handle carefully if there's existing data)

-- Step 3: Alter purchase_requests table
ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS estimation_id INTEGER REFERENCES project_estimations(id);

UPDATE purchase_requests pr
SET estimation_id = (
    SELECT DISTINCT pe.id 
    FROM project_estimations pe
    WHERE pe.project_id = pr.project_id 
    AND pe.is_active = true
    LIMIT 1
);

-- Step 4: Alter purchase_request_items table
ALTER TABLE purchase_request_items
RENAME COLUMN item_name TO purchase_request_item_name;

ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS unit VARCHAR(20),
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';

-- Remove old columns that are no longer needed
ALTER TABLE purchase_request_items
DROP COLUMN IF EXISTS estimation_item_id,
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS room_name,
DROP COLUMN IF EXISTS is_component,
DROP COLUMN IF EXISTS item_description;

-- Remove old composite constraint (no longer needed)
ALTER TABLE purchase_request_items
DROP CONSTRAINT IF EXISTS unique_pr_estimation_item;

-- Step 5: Update purchase_requests status values
ALTER TABLE purchase_requests
ALTER COLUMN status TYPE VARCHAR(50);

UPDATE purchase_requests 
SET status = 'confirmed' 
WHERE status IN ('Draft', 'Submitted', 'Approved');

UPDATE purchase_requests 
SET status = 'cancelled' 
WHERE status IN ('Rejected', 'Cancelled');

COMMIT;
```

### 2. API Changes

#### A. Create PR API - Complete Redesign

**New Request Structure:**
```json
{
  "project_id": 101,
  "estimation_id": 1,
  "vendor_id": 5,
  "items": [
    {
      // PR Item definition
      "purchase_request_item_name": "Full TV Unit",
      "quantity": 1,
      "unit": "no",
      
      // Links to estimation items with weightage
      "estimation_links": [
        {
          "estimation_item_id": 123,
          "linked_qty": 1,
          "weightage": 1.0,
          "notes": "Complete TV unit"
        }
      ]
    },
    {
      "purchase_request_item_name": "TV Base Unit",
      "quantity": 2,
      "unit": "no",
      "estimation_links": [
        {
          "estimation_item_id": 123,
          "linked_qty": 2,
          "weightage": 0.5,
          "notes": "Base unit only"
        }
      ]
    },
    {
      "purchase_request_item_name": "TV Wall Unit",
      "quantity": 2,
      "unit": "no",
      "estimation_links": [
        {
          "estimation_item_id": 123,
          "linked_qty": 2,
          "weightage": 0.5,
          "notes": "Wall unit only"
        }
      ]
    }
  ]
}
```

**API Logic:**
```javascript
// 1. Create purchase_request
const prResult = await query(`
  INSERT INTO purchase_requests 
    (pr_number, project_id, estimation_id, vendor_id, status, created_by)
  VALUES ($1, $2, $3, $4, 'confirmed', $5)
  RETURNING id
`, [prNumber, projectId, estimationId, vendorId, userId]);

// 2. For each item
for (const item of items) {
  // Create PR item
  const prItemResult = await query(`
    INSERT INTO purchase_request_items
      (purchase_request_id, purchase_request_item_name, quantity, unit, active, status)
    VALUES ($1, $2, $3, $4, true, 'confirmed')
    RETURNING id
  `, [prId, item.purchase_request_item_name, item.quantity, item.unit]);
  
  // Create estimation links
  for (const link of item.estimation_links) {
    await query(`
      INSERT INTO purchase_request_estimation_links
        (estimation_item_id, purchase_request_item_id, linked_qty, 
         unit_purchase_request_item_weightage, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [link.estimation_item_id, prItemId, link.linked_qty, link.weightage, link.notes]);
  }
}
```

#### B. Available Items API - Add Fulfillment Calculation

```javascript
// Calculate fulfilled quantity for each estimation item
const items = await query(`
  SELECT 
    ei.*,
    COALESCE(SUM(
      prel.linked_qty * prel.unit_purchase_request_item_weightage
    ), 0) as fulfilled_qty,
    (ei.quantity - COALESCE(SUM(
      prel.linked_qty * prel.unit_purchase_request_item_weightage
    ), 0)) as available_qty
  FROM estimation_items ei
  LEFT JOIN purchase_request_estimation_links prel ON ei.id = prel.estimation_item_id
  LEFT JOIN purchase_request_items pri ON prel.purchase_request_item_id = pri.id
  LEFT JOIN purchase_requests pr ON pri.purchase_request_id = pr.id
  WHERE ei.estimation_id = $1
    AND (pr.status != 'cancelled' OR pr.status IS NULL)
    AND (pri.active = true OR pri.active IS NULL)
  GROUP BY ei.id
  HAVING (ei.quantity - COALESCE(SUM(
    prel.linked_qty * prel.unit_purchase_request_item_weightage
  ), 0)) > 0
`, [estimationId]);
```

**Response:**
```json
{
  "items": [
    {
      "id": 123,
      "item_name": "TV Unit",
      "total_qty": 3.0,
      "fulfilled_qty": 0.0,  // From existing PRs
      "available_qty": 3.0,   // Remaining to order
      "unit": "no"
    }
  ]
}
```

#### C. View PR API - Include Links

```javascript
const prDetail = await query(`
  SELECT 
    pr.*,
    v.name as vendor_name
  FROM purchase_requests pr
  LEFT JOIN vendors v ON pr.vendor_id = v.id
  WHERE pr.id = $1
`, [prId]);

const items = await query(`
  SELECT 
    pri.*,
    json_agg(
      json_build_object(
        'estimation_item_id', prel.estimation_item_id,
        'estimation_item_name', ei.item_name,
        'linked_qty', prel.linked_qty,
        'weightage', prel.unit_purchase_request_item_weightage,
        'notes', prel.notes
      )
    ) as estimation_links
  FROM purchase_request_items pri
  LEFT JOIN purchase_request_estimation_links prel ON pri.id = prel.purchase_request_item_id
  LEFT JOIN estimation_items ei ON prel.estimation_item_id = ei.id
  WHERE pri.purchase_request_id = $1
  GROUP BY pri.id
`, [prId]);
```

### 3. UI Changes

#### Create PR Page - Step 1: New Interface

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Estimation Item: TV Unit                                        │
│ Total Quantity: 3 no                                            │
│ Fulfilled: 0 no | Available: 3 no                              │
├─────────────────────────────────────────────────────────────────┤
│ Add Purchase Request Items:                                     │
│                                                                 │
│ [+ Add Item]                                                    │
│                                                                 │
│ Item 1:                                                         │
│ ├─ Name: [Full TV Unit_____________]                          │
│ ├─ Quantity: [1] no                                            │
│ ├─ Link to: TV Unit (123)                                      │
│ │  ├─ Linked Qty: [1] no                                       │
│ │  ├─ Weightage: [1.0] (Full item)                            │
│ │  └─ Notes: [Complete TV unit_____]                          │
│ └─ [Remove Item]                                               │
│                                                                 │
│ Item 2:                                                         │
│ ├─ Name: [TV Base Unit_____________]                          │
│ ├─ Quantity: [2] no                                            │
│ ├─ Link to: TV Unit (123)                                      │
│ │  ├─ Linked Qty: [2] no                                       │
│ │  ├─ Weightage: [0.5] (Half item)                            │
│ │  └─ Notes: [Base unit only________]                         │
│ └─ [Remove Item]                                               │
│                                                                 │
│ Fulfillment Calculation:                                        │
│ Item 1: 1 × 1.0 = 1.0                                          │
│ Item 2: 2 × 0.5 = 1.0                                          │
│ Total Fulfilled: 2.0 / 3.0                                      │
│ Remaining: 1.0 no                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Component Structure:**
```jsx
const CreatePRItem = ({ estimationItems }) => {
  const [prItems, setPRItems] = useState([{
    name: '',
    quantity: '',
    unit: 'no',
    estimationLinks: [{
      estimationItemId: '',
      linkedQty: '',
      weightage: 1.0,
      notes: ''
    }]
  }]);

  const addPRItem = () => {
    setPRItems([...prItems, {
      name: '',
      quantity: '',
      unit: 'no',
      estimationLinks: [{ estimationItemId: '', linkedQty: '', weightage: 1.0 }]
    }]);
  };

  const calculateFulfillment = () => {
    const fulfillmentByEstItem = {};
    
    prItems.forEach(prItem => {
      prItem.estimationLinks.forEach(link => {
        if (!fulfillmentByEstItem[link.estimationItemId]) {
          fulfillmentByEstItem[link.estimationItemId] = 0;
        }
        fulfillmentByEstItem[link.estimationItemId] += 
          link.linkedQty * link.weightage;
      });
    });
    
    return fulfillmentByEstItem;
  };
};
```

#### View PR Page - Show Links

```
┌─────────────────────────────────────────────────────────────────┐
│ Purchase Request Items                                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Full TV Unit - 1 no                                         │
│    └─ Links to: TV Unit (1 × 1.0 = 1.0 fulfilled)             │
│                                                                 │
│ 2. TV Base Unit - 2 no                                         │
│    └─ Links to: TV Unit (2 × 0.5 = 1.0 fulfilled)             │
│                                                                 │
│ 3. TV Wall Unit - 2 no                                         │
│    └─ Links to: TV Unit (2 × 0.5 = 1.0 fulfilled)             │
│                                                                 │
│ Estimation Fulfillment:                                         │
│ ├─ TV Unit: 3.0 / 3.0 (100%) ✓                                │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Key Benefits of New Design

✅ **Flexible Weightage**: Not limited to 0.5/0.5 splits
✅ **Complex Scenarios**: One PR item can contribute to multiple estimation items
✅ **Clear Tracking**: Explicit fulfillment calculation
✅ **Better Audit**: Links table maintains full history
✅ **Vendor Privacy**: PR items have custom names, no customer pricing
✅ **Scalable**: Can handle any breakdown complexity

### 5. Migration Strategy

**Phase 1: Database (2-3 hours)**
- Create new tables
- Migrate existing data
- Drop old columns
- Test constraints

**Phase 2: Backend APIs (3-4 hours)**
- Rewrite create PR endpoint
- Update available items calculation
- Update view PR endpoint
- Update delete/cancel logic

**Phase 3: Frontend (4-6 hours)**
- New item builder component
- Estimation links form
- Fulfillment calculator
- Validation logic

**Phase 4: Testing (2-3 hours)**
- Unit tests for fulfillment calculation
- API integration tests
- UI flow testing
- Edge cases

**Total Estimate: 12-16 hours**

### 6. Breaking Changes

⚠️ **This is a complete architectural change**

**Impacts:**
- All existing PRs need data migration
- Frontend completely redesigned
- API contracts changed
- New validation logic

**Recommendation:**
- Backup database before migration
- Test on staging first
- Consider feature flag for rollout
- Document new API thoroughly

### 7. Example Data Flow

**Input (Create PR):**
```json
{
  "vendor_id": 5,
  "items": [
    {
      "name": "Full TV Unit",
      "qty": 1,
      "links": [{"est_id": 123, "qty": 1, "weight": 1.0}]
    }
  ]
}
```

**Database State:**
```
purchase_requests: {id: 1, pr_number: "PR-101-001", ...}
purchase_request_items: {id: 1, pr_id: 1, name: "Full TV Unit", qty: 1}
purchase_request_estimation_links: {
  id: 1, 
  est_item_id: 123, 
  pr_item_id: 1, 
  linked_qty: 1, 
  weightage: 1.0
}
```

**Fulfillment Query Result:**
```
TV Unit: total=3, fulfilled=1, available=2
```

---

## Summary

This is a **significant architectural improvement** that provides:
- Maximum flexibility in item breakdown
- Clear fulfillment tracking with weightage
- Better separation of concerns
- Scalable for complex scenarios

**Ready to proceed with implementation?**
