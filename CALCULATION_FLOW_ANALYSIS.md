# Estimation Calculation Flow - Current Implementation

## Frontend Calculation (Correct)

**File:** `/app/app/projects/[id]/estimation/page.js`
**Function:** `calculateTotals()`

### Step-by-Step Calculation:

```javascript
// Step 1: Calculate category totals
woodwork = sum of (quantity × unit_price) for all woodwork items
misc_internal = sum of (quantity × unit_price) for all misc_internal items  
misc_external = sum of (quantity × unit_price) for all misc_external items

// Step 2: Calculate subtotal
subtotal = woodwork + misc_internal + misc_external

// Step 3: Apply service charge (on subtotal)
serviceCharge = subtotal × (service_charge_percentage / 100)

// Step 4: Apply discount (on subtotal)
discount = subtotal × (discount_percentage / 100)

// Step 5: Calculate final value (pre-GST)
finalTotal = subtotal + serviceCharge - discount

// Step 6: Calculate GST (on final value)
gstAmount = finalTotal × (gst_percentage / 100)

// Step 7: Calculate grand total
grandTotal = finalTotal + gstAmount
```

### Data Sent to Backend:

```javascript
{
  woodwork_value: woodwork,
  misc_internal_value: misc_internal,
  misc_external_value: misc_external,
  total_value: finalTotal,  // ← This is ALREADY calculated with service charge and discount
  service_charge_percentage: X,
  discount_percentage: Y,
  gst_percentage: Z
}
```

---

## Backend Calculation (PROBLEM!)

**File:** `/app/app/api/[[...path]]/route.js`
**Endpoint:** `POST /api/estimations`

### What Backend Does:

```javascript
// Line 547-551
const totalValue = body.total_value;  // ← Receives finalTotal from frontend
const serviceChargeAmount = (totalValue * serviceChargePercentage) / 100;  // ❌ RECALCULATING!
const discountAmount = (totalValue * discountPercentage) / 100;  // ❌ RECALCULATING!
const finalValue = totalValue + serviceChargeAmount - discountAmount;  // ❌ DOUBLE APPLICATION!

// Line 554-555
const gstAmount = (finalValue * gstPercentage) / 100;
```

### The Problem:

1. Frontend sends `total_value` = **Subtotal + Service Charge - Discount**
2. Backend receives this and **applies service charge and discount AGAIN**
3. This results in **incorrect** `finalValue` and `gstAmount`

---

## Example Calculation

Let's trace through an actual example:

### Input:
- Woodwork: ₹25,00,000
- Misc Internal: ₹3,00,000
- Misc External: ₹1,82,000
- Service Charge: 10%
- Discount: 2%
- GST: 18%

### Frontend Calculation (Correct):

```
Subtotal = 25,00,000 + 3,00,000 + 1,82,000 = ₹29,82,000

Service Charge = 29,82,000 × 10% = ₹2,98,200

Discount = 29,82,000 × 2% = ₹59,640

Final Value (pre-GST) = 29,82,000 + 2,98,200 - 59,640 = ₹32,20,560

GST = 32,20,560 × 18% = ₹5,79,700.80

Grand Total = 32,20,560 + 5,79,700.80 = ₹38,00,260.80
```

### Backend Recalculation (Wrong):

```
totalValue (received) = ₹32,20,560  (frontend's finalTotal)

serviceChargeAmount = 32,20,560 × 10% = ₹3,22,056  ❌ WRONG!

discountAmount = 32,20,560 × 2% = ₹64,411.20  ❌ WRONG!

finalValue = 32,20,560 + 3,22,056 - 64,411.20 = ₹34,78,204.80  ❌ WRONG!

gstAmount = 34,78,204.80 × 18% = ₹6,26,076.86  ❌ WRONG!
```

---

## What Gets Stored in Database

Based on backend calculation:

```sql
INSERT INTO project_estimations (
  total_value = 32,20,560,           -- Frontend's finalTotal
  service_charge_amount = 3,22,056,   -- ❌ Recalculated (wrong)
  discount_amount = 64,411.20,        -- ❌ Recalculated (wrong)
  final_value = 34,78,204.80,         -- ❌ Wrong!
  gst_amount = 6,26,076.86            -- ❌ Wrong!
)
```

---

## The Fix Needed

### Option 1: Frontend sends subtotal instead of finalTotal

**Change frontend to send:**
```javascript
{
  total_value: subtotal,  // Raw sum before service charge/discount
  service_charge: serviceCharge,  // Pre-calculated
  discount: discount,  // Pre-calculated
  // ... rest
}
```

**Backend keeps current logic:**
```javascript
const subtotal = body.total_value;
const serviceChargeAmount = (subtotal * serviceChargePercentage) / 100;
const discountAmount = (subtotal * discountPercentage) / 100;
const finalValue = subtotal + serviceChargeAmount - discountAmount;
```

### Option 2: Backend accepts pre-calculated values (RECOMMENDED)

**Frontend sends everything pre-calculated** (already doing this):
```javascript
{
  subtotal: subtotal,
  service_charge: serviceCharge,
  discount: discount,
  total_value: finalTotal,  // After service charge and discount
  gst_amount: gstAmount
}
```

**Backend just stores the values:**
```javascript
const result = await query(
  `INSERT INTO project_estimations (...)
   VALUES (...)`,
  [subtotal, serviceCharge, discount, finalValue, gstAmount, ...]
);
```

---

## Current Issue Summary

**Problem:** Backend is recalculating service charge and discount on already-calculated `total_value`, causing:
- Wrong `service_charge_amount` stored
- Wrong `discount_amount` stored  
- Wrong `final_value` stored
- Wrong `gst_amount` stored

**Impact:** 
- Display shows correct values (from frontend calculation)
- But database stores wrong values
- Any reports/analytics based on stored values will be incorrect

**Solution:** Backend should either:
1. Receive subtotal and recalculate (consistent with backend logic)
2. Accept pre-calculated values from frontend (trust frontend calculation)

**Recommendation:** Option 2 - Accept pre-calculated values, since frontend already has the correct logic and user sees those values before submitting.
