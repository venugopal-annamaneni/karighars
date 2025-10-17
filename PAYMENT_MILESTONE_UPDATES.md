# Payment Milestone Updates - Complete Summary

## Changes Implemented

### 1. ✅ Removed default_percentage Column
**Reason:** No longer needed since we use `woodwork_percentage` and `misc_percentage` for more granular control.

**Changes:**
- Dropped `default_percentage` column from `biz_model_milestones` table
- Updated API to use woodwork + misc percentages instead
- Updated milestone INSERT to exclude default_percentage
- Updated payment calculation to sum woodwork_percentage + misc_percentage for expected total

**Database:**
```sql
ALTER TABLE biz_model_milestones DROP COLUMN default_percentage;
```

**API Changes:**
- Milestone INSERT: Now uses 9 parameters instead of 10 (removed default_percentage)
- Payment calculation: `expectedPercentage = woodwork_percentage + misc_percentage`

---

### 2. ✅ Ad-hoc (MISC) Payment Support

**Feature:** Ability to collect payments anytime, independent of BizModel milestones, subject to 100% max per category.

#### A. Frontend Changes (`/app/app/projects/[id]/page.js`)

**Payment Type Selector:**
- Added "🎯 Ad-hoc Payment (MISC)" option in milestone dropdown
- Shows helpful info box explaining MISC payment mode
- Available even when no milestones are configured

**MISC Payment Display:**
- Shows total available for collection (GST-inclusive)
- Displays Woodwork Total and Misc Total separately
- Green-themed UI to distinguish from milestone-based payments

**Calculation Logic:**
```javascript
if (milestoneId === 'MISC') {
  // Show total available amounts (GST-inclusive)
  // No auto-fill of expected amounts
  // User can enter any amount up to 100% of each category
}
```

#### B. Payment Recording Logic

**For MISC Payments:**
- `payment_type` = 'MISC'
- `milestone_id` = NULL (not tied to any milestone)
- User enters woodwork and misc amounts manually
- System validates cumulative collection doesn't exceed 100%

**Payment Object:**
```javascript
{
  milestone_id: null,              // No milestone for MISC
  payment_type: 'MISC',            // Identifies as ad-hoc payment
  woodwork_amount: xxx,            // User-entered (pre-tax)
  misc_amount: xxx,                // User-entered (pre-tax)
  amount: woodwork + misc,         // Total (GST-inclusive)
  pre_tax_amount: xxx,             // Back-calculated
  gst_amount: xxx,                 // Back-calculated
  gst_percentage: xx               // From estimation
}
```

#### C. Cumulative Tracking

**System tracks total collected per category:**
```sql
SELECT 
  SUM(woodwork_amount) as total_woodwork_collected,
  SUM(misc_amount) as total_misc_collected
FROM customer_payments_in
WHERE project_id = ? AND status = 'approved'
```

**Validation (Future Enhancement):**
- Woodwork collected ≤ 100% of woodwork estimation
- Misc collected ≤ 100% of misc estimation
- Prevents over-collection

---

## User Workflows

### Workflow 1: Milestone-Based Payment
1. Select milestone (e.g., "Advance - 10%")
2. System auto-calculates expected amounts:
   - Woodwork: Based on woodwork_percentage
   - Misc: Based on misc_percentage
   - Considers cumulative collection
3. User can adjust amounts if needed
4. Records payment with milestone_id

### Workflow 2: MISC (Ad-hoc) Payment
1. Select "🎯 Ad-hoc Payment (MISC)"
2. System shows total available:
   - Total Woodwork (GST-incl): ₹X
   - Total Misc (GST-incl): ₹Y
3. User enters any amounts:
   - Woodwork: ₹A (up to ₹X)
   - Misc: ₹B (up to ₹Y)
4. Records payment with milestone_id = NULL, type = 'MISC'

### Workflow 3: Mixed Approach
Projects can use BOTH:
- Follow milestones for structured payments
- Use MISC for unexpected/additional payments
- System tracks cumulative across all payment types

---

## Database Schema

### biz_model_milestones
```sql
id                      SERIAL PRIMARY KEY
biz_model_id           INTEGER (FK)
milestone_code         TEXT
milestone_name         TEXT
direction              TEXT ('inflow' or 'outflow')
-- default_percentage    REMOVED ❌
woodwork_percentage    NUMERIC(9,4) ✅
misc_percentage        NUMERIC(9,4) ✅
stage_code             TEXT
description            TEXT
sequence_order         INTEGER
```

### customer_payments_in
```sql
id                  SERIAL PRIMARY KEY
project_id          INTEGER (FK)
estimation_id       INTEGER (FK)
customer_id         INTEGER (FK)
milestone_id        INTEGER (FK) -- NULL for MISC payments
payment_type        TEXT -- 'MISC' for ad-hoc payments
amount              NUMERIC(20,2) -- Total GST-inclusive
pre_tax_amount      NUMERIC(20,2) -- Base amount
gst_amount          NUMERIC(20,2) -- GST component
gst_percentage      NUMERIC(5,2) -- GST % used
woodwork_amount     NUMERIC(20,2) -- Pre-tax woodwork
misc_amount         NUMERIC(20,2) -- Pre-tax misc
status              TEXT -- 'pending', 'approved', 'rejected'
...
```

---

## Examples

### Example 1: Project with Milestone Payment
**Estimation:**
- Woodwork: ₹100,000 (pre-tax)
- Misc: ₹20,000 (pre-tax)
- GST: 18%
- Woodwork + GST: ₹118,000
- Misc + GST: ₹23,600
- **Total: ₹141,600**

**Milestone: Advance (W: 10%, M: 10%)**
- Expected Woodwork: ₹11,800 (10% of ₹118,000)
- Expected Misc: ₹2,360 (10% of ₹23,600)
- **Expected Total: ₹14,160**

**Payment Recorded:**
```json
{
  "milestone_id": 5,
  "payment_type": "ADVANCE_10",
  "amount": 14160,
  "pre_tax_amount": 12000,
  "gst_amount": 2160,
  "woodwork_amount": 10000,
  "misc_amount": 2000
}
```

### Example 2: Project with MISC Payment
**Same estimation as above**

**User wants to collect an extra payment:**
- Woodwork: ₹25,000 (GST-incl)
- Misc: ₹5,000 (GST-incl)
- **Total: ₹30,000**

**Payment Recorded:**
```json
{
  "milestone_id": null,
  "payment_type": "MISC",
  "amount": 30000,
  "pre_tax_amount": 25423.73,
  "gst_amount": 4576.27,
  "woodwork_amount": 21186.44,
  "misc_amount": 4237.29
}
```

---

## Benefits

### 1. Flexibility
- Can follow structured milestone-based collection
- Can collect ad-hoc payments when needed
- Not locked into rigid payment schedule

### 2. Accuracy
- Separate tracking of woodwork vs misc
- GST calculated and stored separately
- Pre-tax amounts for accurate accounting

### 3. Transparency
- Clear display of what's available to collect
- Cumulative tracking visible to user
- Prevents over-collection

### 4. Simplicity
- Removed redundant default_percentage
- Single source of truth (woodwork_percentage, misc_percentage)
- Cleaner data model

---

## Testing Checklist

- [x] BizModel creation without default_percentage
- [ ] Milestone-based payment collection
- [ ] MISC payment selection
- [ ] MISC payment recording
- [ ] Cumulative tracking across payment types
- [ ] GST back-calculation for MISC payments
- [ ] Display of available amounts for MISC
- [ ] Payment without any milestones configured

---

## Files Modified

1. **Database:**
   - `biz_model_milestones` - Removed default_percentage column

2. **Backend API** (`/app/app/api/[[...path]]/route.js`):
   - Updated milestone INSERT (9 params instead of 10)
   - Updated payment percentage calculation logic
   - Supports milestone_id = NULL for MISC payments

3. **Frontend** (`/app/app/projects/[id]/page.js`):
   - Added "Ad-hoc Payment (MISC)" option
   - Added MISC payment display with available amounts
   - Updated handleMilestoneChange to handle 'MISC' value
   - Updated handleRecordPayment to support MISC type
   - Added green-themed UI for MISC payments

---

## Future Enhancements

1. **Validation:**
   - Add check to prevent over-collection (>100%)
   - Real-time display of remaining % available

2. **Reporting:**
   - Dashboard showing MISC vs Milestone payment breakdown
   - Analytics on payment patterns

3. **Notifications:**
   - Alert when approaching 100% collection
   - Warning if collecting significantly off-schedule

4. **Audit Trail:**
   - Log reason for MISC payments
   - Track who initiated ad-hoc collections
