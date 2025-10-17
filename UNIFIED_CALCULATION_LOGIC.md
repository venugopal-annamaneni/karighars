# Fixed: Unified Calculation Logic - Frontend & Backend

## Problem Summary
**Before:** Frontend sent pre-calculated `final_value` as `total_value`, and backend recalculated service charge and discount on it, causing double application.

**After:** Frontend sends raw `subtotal` as `total_value`, backend recalculates everything consistently.

---

## Unified Calculation Formula

Both frontend (for display) and backend (for storage) now use identical logic:

```
Step 1: Subtotal = Woodwork + Misc Internal + Misc External

Step 2: Service Charge Amount = Subtotal × Service Charge %

Step 3: Discount Amount = Subtotal × Discount %

Step 4: Final Value = Subtotal + Service Charge Amount - Discount Amount

Step 5: GST Amount = Final Value × GST %

Step 6: Grand Total = Final Value + GST Amount
```

---

## Frontend Implementation

**File:** `/app/app/projects/[id]/estimation/page.js`

```javascript
const calculateTotals = () => {
  // Calculate category totals
  let woodwork = 0;
  let misc_internal = 0;
  let misc_external = 0;
  
  items.forEach(item => {
    const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    if (item.category === 'woodwork') woodwork += total;
    else if (item.category === 'misc_internal') misc_internal += total;
    else if (item.category === 'misc_external') misc_external += total;
  });
  
  // Step 1: Calculate subtotal
  const subtotal = woodwork + misc_internal + misc_external;
  
  // Step 2: Calculate service charge
  const serviceCharge = (subtotal * (formData.service_charge_percentage || 0)) / 100;
  
  // Step 3: Calculate discount
  const discount = (subtotal * (formData.discount_percentage || 0)) / 100;
  
  // Step 4: Calculate final value (pre-GST)
  const finalTotal = subtotal + serviceCharge - discount;
  
  // Step 5: Calculate GST
  const gstAmount = (finalTotal * (formData.gst_percentage || 0)) / 100;
  
  // Step 6: Calculate grand total
  const grandTotal = finalTotal + gstAmount;
  
  return {
    woodwork_value: woodwork,
    misc_internal_value: misc_internal,
    misc_external_value: misc_external,
    total_value: subtotal,  // ✅ Send RAW subtotal to backend
    subtotal: subtotal,
    service_charge: serviceCharge,
    discount: discount,
    final_value: finalTotal,
    gst_amount: gstAmount,
    grand_total: grandTotal
  };
};
```

**What gets sent to backend:**
```javascript
POST /api/estimations
{
  total_value: 2982000,              // ✅ RAW subtotal
  woodwork_value: 2500000,
  misc_internal_value: 300000,
  misc_external_value: 182000,
  service_charge_percentage: 10,
  discount_percentage: 2,
  gst_percentage: 18,
  // ... other fields
}
```

---

## Backend Implementation

**File:** `/app/app/api/[[...path]]/route.js`

```javascript
// Calculate from subtotal (total_value is raw sum before service charge/discount)
const subtotal = parseFloat(body.total_value) || 0;
const discountPercentage = parseFloat(body.discount_percentage) || 0;

// Step 2: Calculate service charge
const serviceChargeAmount = (subtotal * serviceChargePercentage) / 100;

// Step 3: Calculate discount
const discountAmount = (subtotal * discountPercentage) / 100;

// Step 4: Calculate final value
const finalValue = subtotal + serviceChargeAmount - discountAmount;

// Step 5: Calculate GST
const gstPercentage = parseFloat(body.gst_percentage) || 18.00;
const gstAmount = (finalValue * gstPercentage) / 100;

// Store in database
INSERT INTO project_estimations (
  total_value,              // = subtotal (2982000)
  service_charge_amount,    // = calculated (298200)
  discount_amount,          // = calculated (59640)
  final_value,              // = calculated (3220560)
  gst_amount,               // = calculated (579701)
  ...
)
```

---

## Example Calculation

### Input:
- Woodwork: ₹25,00,000
- Misc Internal: ₹3,00,000
- Misc External: ₹1,82,000
- Service Charge: 10%
- Discount: 2%
- GST: 18%

### Both Frontend & Backend Calculate:

```
Step 1: Subtotal
= 25,00,000 + 3,00,000 + 1,82,000
= ₹29,82,000

Step 2: Service Charge Amount
= 29,82,000 × 10%
= ₹2,98,200

Step 3: Discount Amount
= 29,82,000 × 2%
= ₹59,640

Step 4: Final Value
= 29,82,000 + 2,98,200 - 59,640
= ₹32,20,560

Step 5: GST Amount
= 32,20,560 × 18%
= ₹5,79,700.80

Step 6: Grand Total
= 32,20,560 + 5,79,700.80
= ₹38,00,260.80
```

---

## Database Schema

**Table:** `project_estimations`

| Column | Value | Description |
|--------|-------|-------------|
| total_value | 29,82,000 | Raw subtotal (sum of items) |
| woodwork_value | 25,00,000 | Woodwork component |
| misc_internal_value | 3,00,000 | Misc internal component |
| misc_external_value | 1,82,000 | Misc external component |
| service_charge_percentage | 10.00 | Service charge % |
| service_charge_amount | 2,98,200 | Calculated service charge |
| discount_percentage | 2.00 | Discount % |
| discount_amount | 59,640 | Calculated discount |
| final_value | 32,20,560 | After service charge & discount |
| gst_percentage | 18.00 | GST % |
| gst_amount | 5,79,701 | Calculated GST |

**Derived Values (not stored):**
- Grand Total = final_value + gst_amount = ₹38,00,261

---

## Display in UI

### Projects List Page:
- **Estimated Value:** ₹38,00,261 (final_value + gst_amount)

### Project Detail Page:
- **Estimated Value (with GST):** ₹38,00,261 (final_value + gst_amount)

### Estimation Detail Page:
Shows breakdown:
- Subtotal: ₹29,82,000
- Service Charge (+10%): ₹2,98,200
- Discount (-2%): ₹59,640
- **Final Value:** ₹32,20,560
- GST (+18%): ₹5,79,701
- **Grand Total:** ₹38,00,261

---

## Key Points

✅ **Single Source of Truth:** Backend calculates all values from subtotal
✅ **Consistent Logic:** Frontend uses same formula for display
✅ **No Double Calculation:** Service charge and discount applied only once
✅ **Accurate Storage:** Database contains correctly calculated values
✅ **Transparent Display:** Users see breakdown of all calculations

---

## Testing Checklist

- [ ] Create new estimation with service charge and discount
- [ ] Verify subtotal calculation (sum of items)
- [ ] Verify service charge = subtotal × %
- [ ] Verify discount = subtotal × %
- [ ] Verify final value = subtotal + service charge - discount
- [ ] Verify GST = final value × %
- [ ] Verify grand total = final value + GST
- [ ] Check database values match UI display
- [ ] Verify dashboard aggregates use correct values
- [ ] Test with 0% service charge
- [ ] Test with 0% discount
- [ ] Test with different GST percentages
