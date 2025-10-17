# Estimation Revision & Overpayment Handling - Solution Design

## Problem Scenario

**Situation:**
1. Original Estimation: ₹35,00,000
2. Customer Payments Collected (Approved): ₹15,00,000
3. Revised Estimation: ₹12,00,000 (**Lower than collected**)
4. **Overpayment:** ₹3,00,000

**Question:** How to handle the overpayment?

---

## Solution Options

### Option 1: Credit Note System (RECOMMENDED)

**Concept:** Issue a credit note to customer for the overpaid amount, which can be:
- Adjusted against future payments in the same project
- Adjusted against other projects for the same customer
- Refunded (if customer requests)

**Implementation:**

#### A. Database Schema
```sql
-- Add credit_notes table
CREATE TABLE credit_notes (
  id SERIAL PRIMARY KEY,
  credit_note_number TEXT UNIQUE NOT NULL,  -- e.g., CN-001
  project_id INTEGER REFERENCES projects(id),
  customer_id INTEGER REFERENCES customers(id),
  original_estimation_id INTEGER REFERENCES project_estimations(id),
  revised_estimation_id INTEGER REFERENCES project_estimations(id),
  amount_collected NUMERIC(20,2),
  revised_estimation_value NUMERIC(20,2),
  credit_amount NUMERIC(20,2),  -- Overpaid amount
  reason TEXT,
  status TEXT CHECK (status IN ('active', 'adjusted', 'refunded', 'expired')),
  issued_by INTEGER REFERENCES users(id),
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,  -- Optional expiry
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Add credit_note_adjustments table
CREATE TABLE credit_note_adjustments (
  id SERIAL PRIMARY KEY,
  credit_note_id INTEGER REFERENCES credit_notes(id),
  payment_id INTEGER REFERENCES customer_payments_in(id),  -- Which payment used this credit
  project_id INTEGER REFERENCES projects(id),  -- Which project was it applied to
  adjusted_amount NUMERIC(20,2),
  adjusted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  adjusted_by INTEGER REFERENCES users(id)
);

-- Add credit_balance to customers
ALTER TABLE customers 
ADD COLUMN credit_balance NUMERIC(20,2) DEFAULT 0.00;
```

#### B. Workflow

**Step 1: Detect Overpayment on Estimation Revision**
```javascript
// When creating new estimation version
const totalCollected = await getTotalApprovedPayments(projectId);
const newEstimationValue = finalValue + gstAmount;

if (totalCollected > newEstimationValue) {
  const overpayment = totalCollected - newEstimationValue;
  
  // Flag for credit note generation
  return {
    status: 'overpayment_detected',
    overpayment: overpayment,
    requires_credit_note: true
  };
}
```

**Step 2: Generate Credit Note**
```javascript
// Admin/Finance action
const creditNote = {
  credit_note_number: generateCreditNoteNumber(),  // CN-2024-001
  project_id: projectId,
  customer_id: customerId,
  amount_collected: totalCollected,
  revised_estimation_value: newEstimationValue,
  credit_amount: overpayment,
  reason: 'Estimation revised downward',
  status: 'active',
  expires_at: null  // Or set expiry (e.g., 1 year)
};
```

**Step 3: Update Customer Credit Balance**
```sql
UPDATE customers 
SET credit_balance = credit_balance + overpayment
WHERE id = customer_id;
```

**Step 4: Adjust Against Future Payments**
```javascript
// When recording new payment
if (customerCreditBalance > 0) {
  // Show option to adjust credit
  const paymentDue = 5000;
  const creditToApply = Math.min(customerCreditBalance, paymentDue);
  const cashToCollect = paymentDue - creditToApply;
  
  // Customer only pays: cashToCollect
  // Record adjustment in credit_note_adjustments
}
```

**Step 5: Ledger Entries**
```
CREDIT NOTE ISSUED:
Dr. Customer Payments (Revenue) - ₹3,00,000
Cr. Customer Credit Balance (Liability) - ₹3,00,000

CREDIT ADJUSTED (Future):
Dr. Customer Credit Balance - ₹3,00,000
Cr. Customer Payments (Revenue) - ₹3,00,000
```

---

### Option 2: Advance Payment System

**Concept:** Treat overpayment as an advance for this project.

**Pros:**
- Simpler than credit notes
- Money stays with project

**Cons:**
- If project estimation keeps changing, it becomes complex
- Customer may want refund if project scope reduces significantly

**Implementation:**
```javascript
// Mark overpayment as "advance" in project
UPDATE projects 
SET advance_balance = overpayment
WHERE id = project_id;

// Adjust in future milestone payments
const paymentDue = calculateMilestonePayment();
const advanceToAdjust = Math.min(advanceBalance, paymentDue);
const amountToCollect = paymentDue - advanceToAdjust;
```

---

### Option 3: Refund with Ledger Adjustment

**Concept:** Immediately refund the overpayment to customer.

**Pros:**
- Clean and transparent
- Customer gets money back

**Cons:**
- Cash outflow
- More complex if customer has multiple projects

**Implementation:**
```sql
-- Create refund payment
INSERT INTO payments_out (
  customer_id,
  project_id,
  payment_type,
  amount,
  reason,
  mode,
  status
) VALUES (
  customer_id,
  project_id,
  'refund',
  overpayment,
  'Overpayment due to estimation revision',
  'bank',
  'pending'
);

-- Ledger entry
INSERT INTO project_ledger (
  project_id,
  entry_type,
  source_table,
  source_id,
  debit,
  credit,
  balance,
  description
) VALUES (
  project_id,
  'refund',
  'payments_out',
  refund_id,
  overpayment,
  0,
  new_balance,
  'Refund: Estimation revised downward'
);
```

---

## Recommended Solution: Option 1 (Credit Note System)

### Why Credit Notes?

1. **Flexibility:** Customer can choose adjustment or refund
2. **Multi-Project:** Can be used across customer's projects
3. **Standard Practice:** Follows accounting standards
4. **Audit Trail:** Clear record of why credit was issued
5. **Time Buffer:** Customer doesn't need immediate decision

### Business Rules to Define

#### 1. Credit Note Validity
- **Validity Period:** 1 year / unlimited
- **Transferability:** Can be used for other projects?
- **Partial Use:** Can be used in parts?

#### 2. Auto-Adjustment
- **Auto-apply:** Automatically adjust against next payment?
- **Manual approval:** Finance must approve each adjustment?

#### 3. Refund Process
- **Refund on request:** Customer can request refund anytime
- **Auto-refund:** After project completion if unused
- **Approval required:** Admin/Finance approval needed

#### 4. Expiry Handling
- **Expire after 1 year?**
- **Convert to company revenue** if expired?
- **Extend validity** on request?

---

## Implementation Phases

### Phase 1: Detection & Warning
```javascript
// When creating new estimation version
if (overpayment detected) {
  // Show warning in UI
  // "⚠️ New estimation (₹12L) is lower than collected (₹15L)"
  // "Overpayment: ₹3L"
  // "A credit note will need to be issued"
  
  // Require admin approval for this revision
}
```

### Phase 2: Credit Note Generation
- Admin UI to generate credit note
- Email to customer with credit note PDF
- Update customer credit balance
- Add entry to project ledger

### Phase 3: Credit Application
- Show credit balance in payment form
- Option to apply credit (full or partial)
- Record adjustment transaction
- Update credit note status

### Phase 4: Refund Process
- UI for customer to request refund
- Finance approval workflow
- Process refund payment
- Update credit note to 'refunded'

---

## UI/UX Flow

### Estimation Revision Screen
```
┌─────────────────────────────────────────────────┐
│ ⚠️ OVERPAYMENT ALERT                            │
├─────────────────────────────────────────────────┤
│ Original Estimation: ₹35,00,000                 │
│ Total Collected:     ₹15,00,000 (Approved)      │
│ New Estimation:      ₹12,00,000                 │
│                                                  │
│ 🔴 Overpayment:      ₹3,00,000                  │
│                                                  │
│ [✓] Generate Credit Note                        │
│                                                  │
│ Reason for revision:                            │
│ [__________________________________]            │
│                                                  │
│ [ Cancel ]          [ Approve Revision ]        │
└─────────────────────────────────────────────────┘
```

### Payment Recording Screen
```
┌─────────────────────────────────────────────────┐
│ 💳 Customer Credit Available: ₹3,00,000         │
├─────────────────────────────────────────────────┤
│ Payment Due: ₹5,00,000                          │
│                                                  │
│ Apply Credit: [₹3,00,000] (max)                 │
│                                                  │
│ Customer Pays: ₹2,00,000                        │
│                                                  │
│ [ Record Payment ]                              │
└─────────────────────────────────────────────────┘
```

### Customer Credit Notes List
```
┌─────────────────────────────────────────────────┐
│ Credit Notes                                     │
├──────┬──────────┬──────────┬─────────┬──────────┤
│ CN#  │ Project  │ Amount   │ Status  │ Action   │
├──────┼──────────┼──────────┼─────────┼──────────┤
│ CN01 │ Proj-002 │ ₹3,00,000│ Active  │ [Adjust] │
│ CN02 │ Proj-005 │ ₹50,000  │ Used    │ [View]   │
└──────┴──────────┴──────────┴─────────┴──────────┘
```

---

## Alternative: Simpler "Project Credit" Approach

If credit notes are too complex for MVP:

**Simple Version:**
1. Add `customer_credit` field to `projects` table
2. When overpayment detected, store in project credit
3. Auto-adjust from credit in next payments
4. Show credit balance on project page
5. Allow manual refund if requested

**Pros:** Much simpler to implement
**Cons:** Less flexible, only works within same project

---

## Questions to Answer Before Implementation

1. **Credit Scope:** Project-level or Customer-level credit?
2. **Validity:** Do credits expire?
3. **Auto-apply:** Automatic adjustment or manual?
4. **Refund Policy:** When can customer request refund?
5. **Multi-project:** Can credit from Project A be used in Project B?
6. **Partial Adjustments:** Allow splitting credit across payments?
7. **Approval Required:** Who approves credit note generation?
8. **Accounting:** Which account codes to use for credit notes?

---

## My Recommendation for KG Interiors

**Start with "Project Credit" (Simple Version):**

**Phase 1 (Current):**
- Detect overpayment on estimation revision
- Show warning to user
- Block revision if not approved by admin
- Store credit in project

**Phase 2 (Future):**
- Implement full credit note system if needed
- Add customer-level credit balance
- Multi-project credit usage
- Formal refund process

**Reasoning:**
- KG Interiors is ERP for internal use
- Estimation revisions are likely rare
- Project-level credit is sufficient initially
- Can upgrade to full credit note system later if business grows

---

## Sample Code Structure

```javascript
// Validation before creating new estimation
async function validateEstimationRevision(projectId, newEstimationValue) {
  const collected = await getTotalCollected(projectId);
  
  if (collected > newEstimationValue) {
    return {
      allowed: false,
      overpayment: collected - newEstimationValue,
      requires: 'admin_approval_and_credit_note'
    };
  }
  
  return { allowed: true };
}

// Generate credit note
async function generateCreditNote(projectId, overpayment, reason) {
  const creditNote = await db.creditNotes.create({
    project_id: projectId,
    customer_id: project.customer_id,
    credit_amount: overpayment,
    reason: reason,
    status: 'active'
  });
  
  // Update customer credit balance
  await db.customers.increment('credit_balance', overpayment);
  
  // Add ledger entry
  await createLedgerEntry({
    type: 'credit_note_issued',
    amount: overpayment
  });
  
  return creditNote;
}

// Apply credit to payment
async function recordPaymentWithCredit(paymentData, creditToApply) {
  const netPayment = paymentData.amount - creditToApply;
  
  // Record payment
  const payment = await db.payments.create({
    amount: paymentData.amount,
    credit_adjusted: creditToApply,
    net_collected: netPayment
  });
  
  // Adjust credit note
  await adjustCreditNote(creditNoteId, creditToApply);
  
  return payment;
}
```

---

## Summary

**Recommended Approach:** Project-level credit system initially, upgrade to customer-level credit notes if needed.

**Key Features:**
✅ Detect overpayment on estimation revision
✅ Require admin approval for revisions with overpayment
✅ Store credit at project level
✅ Auto-apply credit in future payments
✅ Manual refund option
✅ Full audit trail in ledger

**What to implement now:**
1. Overpayment detection
2. Admin approval workflow
3. Project credit storage
4. Credit adjustment in payments
5. Ledger entries for credit

**What to defer:**
- Formal credit note documents
- Customer-level credit balance
- Multi-project credit usage
- Credit expiry logic
- Complex refund workflows
