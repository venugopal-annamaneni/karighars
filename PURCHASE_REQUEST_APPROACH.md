# Purchase Request Feature - Implementation Approach

## Feature Overview
Allow Estimators/Admins to create Purchase Requests (PRs) by selecting estimation items in "Queued" status, assigning a vendor, and tracking the procurement process.

---

## 1. Database Schema Design

### Table: `purchase_requests`
```sql
CREATE TABLE purchase_requests (
    id SERIAL PRIMARY KEY,
    pr_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated: PR-{project_id}-{sequence}
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'Draft',  -- Draft, Submitted, Approved, Rejected, Cancelled
    
    -- Dates
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Financial
    total_amount NUMERIC(20,2) DEFAULT 0,
    gst_amount NUMERIC(12,2) DEFAULT 0,
    final_amount NUMERIC(20,2) DEFAULT 0,
    
    -- Additional info
    remarks TEXT,
    payment_terms TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    
    -- Constraints
    CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled'))
);

CREATE INDEX idx_pr_project ON purchase_requests(project_id);
CREATE INDEX idx_pr_status ON purchase_requests(status);
CREATE INDEX idx_pr_vendor ON purchase_requests(vendor_id);
```

### Table: `purchase_request_items`
```sql
CREATE TABLE purchase_request_items (
    id SERIAL PRIMARY KEY,
    purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    estimation_item_id INTEGER NOT NULL UNIQUE REFERENCES estimation_items(id) ON DELETE CASCADE,
    
    -- Item details (snapshot from estimation_item)
    category VARCHAR(100),
    room_name VARCHAR(255),
    item_name TEXT,
    quantity NUMERIC(10,2),
    unit VARCHAR(20),
    unit_price NUMERIC(12,2),
    
    -- Pricing (can be different from estimation)
    quoted_price NUMERIC(12,2),  -- Vendor's quoted price
    final_price NUMERIC(12,2),   -- Negotiated final price
    
    -- Totals
    subtotal NUMERIC(20,2),
    gst_amount NUMERIC(12,2),
    item_total NUMERIC(20,2),
    
    -- Delivery tracking
    received_quantity NUMERIC(10,2) DEFAULT 0,
    pending_quantity NUMERIC(10,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_estimation_item UNIQUE (estimation_item_id)
);

CREATE INDEX idx_pri_pr ON purchase_request_items(purchase_request_id);
CREATE INDEX idx_pri_estimation ON purchase_request_items(estimation_item_id);
```

---

## 2. Constants (app/constants.js)

```javascript
export const PURCHASE_REQUEST_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
}

// Update ESTIMATION_ITEM_STATUS to include more statuses
export const ESTIMATION_ITEM_STATUS = {
  QUEUED: 'Queued',
  PR_RAISED: 'PR Raised',
  // Future: ORDERED, RECEIVED, INSTALLED
}
```

---

## 3. API Routes Structure

### Base: `/api/projects/[id]/purchase-requests`

#### **GET** `/api/projects/[id]/purchase-requests`
- **Purpose**: List all purchase requests for a project
- **Response**:
```json
{
  "purchase_requests": [
    {
      "id": 1,
      "pr_number": "PR-101-001",
      "vendor_name": "ABC Suppliers",
      "status": "Submitted",
      "total_amount": 50000,
      "items_count": 15,
      "expected_delivery_date": "2025-02-15",
      "created_at": "2025-01-30T10:00:00Z",
      "created_by_name": "John Doe"
    }
  ]
}
```

#### **POST** `/api/projects/[id]/purchase-requests`
- **Purpose**: Create new purchase request
- **Request Body**:
```json
{
  "vendor_id": 5,
  "estimation_item_ids": [12, 45, 67],
  "expected_delivery_date": "2025-02-15",
  "remarks": "Urgent requirement",
  "payment_terms": "30 days credit"
}
```
- **Process**:
  1. Validate all items are in "Queued" status
  2. Create purchase_request record
  3. Create purchase_request_items for each selected item
  4. Update estimation_items.status to "PR Raised"
  5. Calculate totals
- **Transaction**: All operations in single transaction

#### **GET** `/api/projects/[id]/purchase-requests/[prId]`
- **Purpose**: Get purchase request details with items
- **Response**:
```json
{
  "purchase_request": {
    "id": 1,
    "pr_number": "PR-101-001",
    "vendor": { "id": 5, "name": "ABC Suppliers" },
    "status": "Submitted",
    "total_amount": 50000,
    "created_by": "John Doe",
    "created_at": "2025-01-30T10:00:00Z"
  },
  "items": [
    {
      "id": 1,
      "estimation_item_id": 12,
      "category": "woodwork",
      "room_name": "Living Room",
      "item_name": "TV Unit",
      "quantity": 120,
      "unit": "sqft",
      "unit_price": 1500,
      "subtotal": 180000
    }
  ]
}
```

#### **PUT** `/api/projects/[id]/purchase-requests/[prId]`
- **Purpose**: Update purchase request (only if status = Draft)
- **Request Body**: Same as POST
- **Process**:
  1. Check if PR is in Draft status
  2. If items changed, revert old items to "Queued" and update new items to "PR Raised"
  3. Update PR details

#### **DELETE** `/api/projects/[id]/purchase-requests/[prId]` (or PATCH for status update)
- **Purpose**: Cancel/Delete purchase request
- **Process**:
  1. Update status to "Cancelled"
  2. Revert all linked estimation_items.status to "Queued"
  3. Soft delete or keep for audit trail

#### **GET** `/api/projects/[id]/purchase-requests/available-items`
- **Purpose**: Get estimation items available for PR (status = Queued)
- **Response**:
```json
{
  "items": [
    {
      "id": 12,
      "category": "woodwork",
      "room_name": "Living Room",
      "item_name": "TV Unit",
      "quantity": 120,
      "unit": "sqft",
      "unit_price": 1500,
      "subtotal": 180000,
      "status": "Queued"
    }
  ],
  "grouped_by_category": {
    "woodwork": [/* items */],
    "misc": [/* items */]
  }
}
```

---

## 4. UI/UX Design

### Page: `/app/projects/[id]/purchase-requests/page.js`

#### **Main View - PR List**
```
┌─────────────────────────────────────────────────────────┐
│  Purchase Requests                  [+ Create PR]        │
├─────────────────────────────────────────────────────────┤
│  Search: [________]   Filter: [All Status ▼]            │
├─────────────────────────────────────────────────────────┤
│  PR Number  │ Vendor      │ Items │ Amount │ Status     │
│  PR-101-001 │ ABC Supply  │  15   │ 50,000 │ Submitted  │
│  PR-101-002 │ XYZ Traders │   8   │ 25,000 │ Approved   │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- PR list table with filters
- Status badges (color-coded)
- "Create PR" button (top-right)
- Quick actions: View, Edit (if Draft), Cancel

#### **Create PR Modal/Page**

**Step 1: Select Items**
```
┌─────────────────────────────────────────────────────────┐
│  Create Purchase Request - Select Items                 │
├─────────────────────────────────────────────────────────┤
│  Filter by Category: [All ▼]                            │
│                                                          │
│  [✓] Select All Queued Items                            │
│                                                          │
│  Category: Woodwork (5 items)                           │
│  [ ] Living Room - TV Unit - 120 sqft @ ₹1,500         │
│  [✓] Bedroom - Wardrobe - 80 sqft @ ₹1,800             │
│  [ ] Kitchen - Cabinets - 50 sqft @ ₹2,000             │
│                                                          │
│  Category: Misc (3 items)                               │
│  [✓] Electrical Work - 1 lumpsum @ ₹15,000             │
│                                                          │
│  Selected: 2 items | Total: ₹159,000                    │
│                                   [Cancel]  [Next →]     │
└─────────────────────────────────────────────────────────┘
```

**Step 2: Vendor & Details**
```
┌─────────────────────────────────────────────────────────┐
│  Create Purchase Request - Details                      │
├─────────────────────────────────────────────────────────┤
│  Vendor*: [Select Vendor ▼]                             │
│  Expected Delivery: [Date Picker]                       │
│  Payment Terms: [__________________________]            │
│  Remarks: [________________________________]            │
│           [________________________________]            │
│                                                          │
│  Summary:                                                │
│  Items: 2                                                │
│  Subtotal: ₹159,000                                     │
│  GST (18%): ₹28,620                                     │
│  Total: ₹187,620                                        │
│                                   [← Back]  [Create PR]  │
└─────────────────────────────────────────────────────────┘
```

**Step 3: Review (Optional)**
- Show selected items in a table
- Summary of PR details
- Confirm and submit

#### **PR Detail View**
```
┌─────────────────────────────────────────────────────────┐
│  PR-101-001                            [Draft Badge]     │
│  [Edit]  [Cancel]  [Download PDF]                       │
├─────────────────────────────────────────────────────────┤
│  Vendor: ABC Suppliers                                   │
│  Expected Delivery: 15-Feb-2025                          │
│  Created: 30-Jan-2025 by John Doe                       │
│                                                          │
│  Items (2):                                              │
│  Room        │ Item      │ Qty │ Unit │ Price │ Total   │
│  Bedroom     │ Wardrobe  │ 80  │ sqft │ 1,800 │ 144,000│
│  Electrical  │ Wiring    │ 1   │ ls   │15,000 │ 15,000 │
│                                                          │
│  Total: ₹187,620                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Layout Integration

### File: `app/projects/[id]/layout.js`

Add new tab after "Customer Payments":
```javascript
const tabs = [
  { name: 'Overview', href: `/projects/${projectId}` },
  { name: 'Base Rates', href: `/projects/${projectId}/base-rates` },
  { name: 'Estimation', href: `/projects/${projectId}/manage-estimation` },
  { name: 'Customer Payments', href: `/projects/${projectId}/customer-payments` },
  { name: 'Purchase Requests', href: `/projects/${projectId}/purchase-requests` }, // NEW
  { name: 'Documents', href: `/projects/${projectId}/documents` },
  { name: 'Ledger', href: `/projects/${projectId}/ledger` },
];
```

---

## 6. Business Logic & Validations

### **PR Creation Validations:**
1. ✅ All selected items must be in "Queued" status
2. ✅ Items must belong to the same project
3. ✅ Vendor must be selected
4. ✅ At least 1 item must be selected
5. ✅ User must be Estimator or Admin role

### **PR Update Validations:**
1. ✅ Can only edit if status = "Draft"
2. ✅ Cannot remove items if PR is Submitted/Approved
3. ✅ If items changed, update statuses accordingly

### **PR Cancellation:**
1. ✅ Update PR status to "Cancelled"
2. ✅ Revert all linked items to "Queued" status
3. ✅ Keep PR record for audit trail

### **Status Workflow:**
```
Draft → Submitted → Approved
   ↓        ↓
Cancelled  Rejected
```

---

## 7. Key Features

### **Phase 1 (MVP):**
- ✅ Create PR with item selection
- ✅ Assign vendor
- ✅ Update item statuses
- ✅ View PR list and details
- ✅ Cancel/Delete PR (with status revert)

### **Phase 2 (Future):**
- Approval workflow (multi-level)
- Partial delivery tracking
- Price negotiation history
- Compare multiple vendor quotes
- Auto-generate PR numbers
- Email notifications
- PDF export
- GRN (Goods Receipt Note) integration

---

## 8. Technical Considerations

### **Database Transactions:**
```javascript
// Example transaction for PR creation
BEGIN TRANSACTION;
  1. INSERT INTO purchase_requests
  2. INSERT INTO purchase_request_items (multiple)
  3. UPDATE estimation_items SET status = 'PR Raised'
COMMIT;
// Rollback if any step fails
```

### **Cascade Rules:**
- Delete Project → Delete PRs → Delete PR Items
- Delete PR → Delete PR Items, Revert estimation_items status
- Delete Vendor → SET NULL on PR (vendor_id)

### **Performance:**
- Index on estimation_items.status for fast "Queued" queries
- Index on purchase_request_items.estimation_item_id for 1-1 checks
- Materialized totals in purchase_requests table (avoid JOIN aggregations)

---

## 9. Migration File

**File:** `migrations/010_purchase_requests.sql`

```sql
BEGIN;

-- Create purchase_requests table
CREATE TABLE purchase_requests (... as defined above);

-- Create purchase_request_items table
CREATE TABLE purchase_request_items (... as defined above);

-- Add indexes
CREATE INDEX idx_pr_project ON purchase_requests(project_id);
-- ... other indexes

-- Add PR Raised status to estimation_items (already exists)
-- No change needed

COMMIT;
```

---

## 10. File Structure

```
/app
├── app/
│   ├── projects/
│   │   └── [id]/
│   │       ├── layout.js (update tabs)
│   │       └── purchase-requests/
│   │           ├── page.js (main PR list)
│   │           └── [prId]/
│   │               └── page.js (PR detail view)
│   ├── api/
│   │   └── projects/
│   │       └── [id]/
│   │           └── purchase-requests/
│   │               ├── route.js (GET all, POST create)
│   │               ├── available-items/
│   │               │   └── route.js (GET queued items)
│   │               └── [prId]/
│   │                   └── route.js (GET, PUT, DELETE)
│   └── constants.js (update with PR statuses)
├── components/
│   └── purchase-requests/
│       ├── PRListTable.js
│       ├── CreatePRModal.js
│       ├── ItemSelectionStep.js
│       ├── VendorDetailsStep.js
│       └── PRDetailView.js
├── migrations/
│   └── 010_purchase_requests.sql
└── schema.sql (update with new tables)
```

---

## 11. User Roles & Permissions

| Action | Estimator | Admin | Viewer |
|--------|-----------|-------|--------|
| View PRs | ✅ | ✅ | ✅ |
| Create PR | ✅ | ✅ | ❌ |
| Edit PR (Draft) | ✅ | ✅ | ❌ |
| Cancel PR | ❌ | ✅ | ❌ |
| Approve PR | ❌ | ✅ | ❌ |

---

## 12. Error Handling

### **Common Errors:**
1. **Item already in another PR**
   - Check: `estimation_item.status != 'Queued'`
   - Response: HTTP 400 - "Item already assigned to another PR"

2. **PR not in editable state**
   - Check: `purchase_request.status != 'Draft'`
   - Response: HTTP 400 - "Cannot edit PR in current status"

3. **Vendor not found**
   - Check: `vendor_id exists`
   - Response: HTTP 404 - "Vendor not found"

4. **Transaction failure**
   - Rollback all changes
   - Response: HTTP 500 - "Failed to create PR. Please try again."

---

## 13. Testing Checklist

### **API Tests:**
- [ ] Create PR with valid items
- [ ] Create PR with already assigned items (should fail)
- [ ] Update PR items (revert old items status)
- [ ] Cancel PR (status reverts)
- [ ] Delete estimation item with PR link (cascade)
- [ ] Get available items (only Queued status)

### **UI Tests:**
- [ ] Display PR list with correct data
- [ ] Filter PRs by status
- [ ] Select items for PR (multi-select)
- [ ] Prevent selecting non-Queued items
- [ ] Display PR totals correctly
- [ ] Edit Draft PR
- [ ] Cannot edit Submitted PR

---

## Summary

This Purchase Request feature provides:
1. ✅ Complete CRUD operations for PRs
2. ✅ Automatic status management for estimation items
3. ✅ 1-1 mapping constraint between PR items and estimation items
4. ✅ Vendor assignment and tracking
5. ✅ Role-based access control
6. ✅ Transaction safety with rollback support
7. ✅ Scalable design for future enhancements

**Next Steps:**
1. Review and confirm approach
2. Create database migration
3. Implement API routes
4. Build UI components
5. Test and deploy
