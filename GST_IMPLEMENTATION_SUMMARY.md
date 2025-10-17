# GST Implementation - Complete Summary

## Changes Implemented

### 1. ✅ Data Cleanup
- Truncated all projects and project-related data
- Truncated all BizModels, stages, and milestones
- Fresh start for new data entry

### 2. ✅ Display Fixes

#### Project Detail Page (`/app/app/projects/[id]/page.js`)
**Before:**
- Displayed only "Final Total" (without GST)
- GST was hidden from view

**After:**
- Added GST card showing: "GST (18%)" with amount
- Updated "Final Total" to show: "Final Total (with GST)"
- Formula: **Final Total = (Subtotal + Service Charge - Discount) + GST**
- Display breakdown:
  - Subtotal
  - Service Charge (+)
  - Discount (-)
  - GST (+)
  - Final Total with GST

### 3. ✅ Payment Recording with Automatic GST

#### Payment Dialog Updates
**Automatic GST Calculation:**
- GST percentage automatically fetched from project estimation (default 18%)
- When user enters payment amounts (woodwork + misc), system automatically:
  1. Calculates total = woodwork + misc
  2. Back-calculates pre-tax amount = total / (1 + GST%)
  3. Calculates GST amount = total - pre-tax amount

**GST Breakdown Display:**
- Shows real-time GST breakdown in payment dialog
- Displays:
  - Pre-Tax Amount
  - GST Amount (at X%)
  - Total Amount
- Note: "All amounts entered above should include GST"

#### Back-calculation Logic
```javascript
// For total payment
const gstPercentage = estimation.gst_percentage || 18;
const totalAmount = woodwork + misc;
const preTaxAmount = totalAmount / (1 + gstPercentage / 100);
const gstAmount = totalAmount - preTaxAmount;

// For woodwork separately
const preTaxWoodwork = woodwork / (1 + gstPercentage / 100);
const woodworkGST = woodwork - preTaxWoodwork;

// For misc separately  
const preTaxMisc = misc / (1 + gstPercentage / 100);
const miscGST = misc - preTaxMisc;
```

### 4. ✅ Database Schema Updates

#### customer_payments_in table - New Fields:
```sql
- pre_tax_amount NUMERIC(20,2) -- Amount before GST
- gst_amount NUMERIC(20,2) -- GST amount back-calculated
- gst_percentage NUMERIC(5,2) -- GST % from estimation
- woodwork_amount NUMERIC(20,2) -- Pre-tax woodwork amount
- misc_amount NUMERIC(20,2) -- Pre-tax misc amount
- amount NUMERIC(20,2) -- Total amount (including GST)
```

**Important:** 
- `woodwork_amount` and `misc_amount` are stored as **pre-tax** amounts
- `amount` is the **total GST-inclusive** amount
- All amounts can be reconstructed using gst_percentage

### 5. ✅ API Updates

#### POST /api/customer-payments
**New Fields Accepted:**
- `pre_tax_amount` - Calculated on frontend
- `gst_amount` - Calculated on frontend
- `gst_percentage` - From estimation

**Stored Data:**
```json
{
  "amount": 118000,           // Total GST-inclusive
  "pre_tax_amount": 100000,   // Base amount
  "gst_amount": 18000,        // GST at 18%
  "gst_percentage": 18,       // Used percentage
  "woodwork_amount": 84745.76, // Pre-tax woodwork (80k / 1.18)
  "misc_amount": 15254.24     // Pre-tax misc (18k / 1.18)
}
```

## User Flow Examples

### Example 1: Creating Estimation
1. Create estimation with:
   - Woodwork: ₹100,000
   - Misc: ₹20,000
   - Service Charge: 10% = ₹12,000
   - Discount: 0%
   - **Subtotal after adjustments: ₹132,000**
   - **GST (18%): ₹23,760**
   - **Final Total (with GST): ₹155,760** ← This is displayed

### Example 2: Recording Payment
1. Select milestone (e.g., "Advance 10%")
2. System shows expected amounts (already GST-inclusive)
3. User enters:
   - Woodwork: ₹100,000 (GST-inclusive)
   - Misc: ₹18,000 (GST-inclusive)
   - **Total: ₹118,000**
4. System automatically shows:
   - Pre-Tax: ₹100,000
   - GST (18%): ₹18,000
   - Total: ₹118,000
5. On save, stores:
   - `amount` = 118000 (total)
   - `pre_tax_amount` = 100000
   - `gst_amount` = 18000
   - `woodwork_amount` = 84745.76 (pre-tax)
   - `misc_amount` = 15254.24 (pre-tax)

## Key Points

1. **GST is ALWAYS included in customer-facing amounts**
   - Estimation totals show GST
   - Expected payment amounts include GST
   - Customer pays GST-inclusive amounts

2. **Pre-tax amounts are stored for accounting**
   - Woodwork and Misc stored as pre-tax
   - GST stored separately
   - Can reconstruct any amount using formula

3. **Single GST percentage per project**
   - Set at estimation level
   - Used for all payments in that project
   - Default: 18%

4. **Accurate financial tracking**
   - Pre-tax revenue tracked separately
   - GST liability tracked separately
   - Total collection = Pre-tax + GST

## Testing Checklist

- [ ] Create new BizModel
- [ ] Create new project with estimation
- [ ] Verify Final Total shows with GST
- [ ] Record payment with milestone
- [ ] Verify GST breakdown displays correctly
- [ ] Check payment stored with all GST fields
- [ ] Verify calculations are accurate

## Files Modified

1. `/app/app/projects/[id]/page.js` - Payment dialog & display
2. `/app/app/api/[[...path]]/route.js` - Payment API
3. Database schema - Added pre_tax_amount, gst_amount, gst_percentage to customer_payments_in

## Formula Reference

```
Total Amount (Customer Pays) = Pre-Tax Amount + GST Amount

Pre-Tax Amount = Total Amount / (1 + GST% / 100)

GST Amount = Total Amount - Pre-Tax Amount

Or alternatively:
GST Amount = Pre-Tax Amount × (GST% / 100)
```

Example with 18% GST:
- Customer pays: ₹118,000
- Pre-tax: ₹118,000 / 1.18 = ₹100,000
- GST: ₹118,000 - ₹100,000 = ₹18,000
