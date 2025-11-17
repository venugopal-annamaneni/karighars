# Estimation Version Column Removal - Analysis

## Current Architecture Comparison

### Purchase Requests (Correct Pattern) ✅
```
purchase_requests table:
- id (PRIMARY KEY)
- pr_number
- project_id
- status
- NO VERSION column
- NO is_active column
- Multiple PRs can exist per project

purchase_request_items:
- id
- purchase_request_id
- stable_item_id
- version (for tracking edits within this PR)
- NO is_active

purchase_request_items_history:
- All fields from purchase_request_items
- version (tracks which edit)
- archived_at, archived_by

Flow: Edit PR → Move items to history → Delete items → Re-insert with version++
```

### Estimations (Current - INCORRECT) ❌
```
project_estimations table:
- id (PRIMARY KEY)
- project_id
- version (1, 2, 3...)  ← WRONG! Creating new estimations
- is_active (true/false) ← WRONG! Should be ONE estimation
- Multiple estimations per project ← WRONG!

estimation_items:
- id
- estimation_id
- stable_item_id
- NO version column

estimation_items_history:
- All fields from estimation_items
- archived_at, archived_by

Flow: Edit estimation → Create NEW estimation → Mark old inactive ← WRONG!
```

---

## The Problem

### Current Behavior (WRONG):
```
Project 1:
  Estimation V1 (id=100, is_active=false)
  Estimation V2 (id=200, is_active=false)
  Estimation V3 (id=300, is_active=true) ← Current

Result: 3 separate estimations!
```

**Issues:**
1. Creates multiple estimation records per project
2. Uses `is_active` flag to track "current" one
3. version column on estimation level (should be on items)
4. Doesn't match PR pattern
5. Confusing: "version" suggests editing, but we're creating new records

### Desired Behavior (CORRECT):
```
Project 1:
  ONE Estimation (id=100)
    Items V1 in history (archived)
    Items V2 in history (archived)
    Items V3 current

Result: 1 estimation, multiple item versions!
```

**Benefits:**
1. ONE estimation per project
2. Edit the SAME estimation
3. Version tracking at ITEM level (in history)
4. Matches PR pattern
5. Clearer semantics

---

## Proposed Solution

### Architecture After Fix

```
project_estimations table:
- id (PRIMARY KEY)
- project_id (UNIQUE - one estimation per project)
- final_value, items_value, gst_amount, etc.
- created_at, created_by
- updated_at, updated_by
- NO version column
- NO is_active column

estimation_items:
- id
- estimation_id
- stable_item_id (UNIQUE within estimation)
- category, item_name, quantity, etc.
- created_at, created_by
- updated_at, updated_by
- NO version column (items are current)

estimation_items_history:
- id
- estimation_id
- stable_item_id
- category, item_name, quantity, etc.
- created_at, created_by
- updated_at, updated_by
- version (incremental: 1, 2, 3...) ← Track edits
- archived_at, archived_by
```

---

## Implementation Steps

### Phase 1: Database Changes

#### Migration 025: Remove version and is_active from project_estimations

```sql
-- Remove is_active (no longer needed - one estimation per project)
ALTER TABLE project_estimations
  DROP COLUMN IF EXISTS is_active;

-- Remove version (tracked at item level instead)
ALTER TABLE project_estimations
  DROP COLUMN IF EXISTS version;

-- Add unique constraint on project_id (one estimation per project)
ALTER TABLE project_estimations
  ADD CONSTRAINT uq_project_estimations_project_id 
  UNIQUE (project_id);

-- Add updated_at and updated_by for tracking edits
ALTER TABLE project_estimations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- Add foreign key
ALTER TABLE project_estimations
  ADD CONSTRAINT fk_project_estimations_updated_by 
  FOREIGN KEY (updated_by) REFERENCES users(id);
```

#### Migration 026: Add version to estimation_items_history

```sql
-- Add version column to track item edit history
ALTER TABLE estimation_items_history
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create index for version queries
CREATE INDEX idx_estimation_items_history_version 
  ON estimation_items_history(estimation_id, stable_item_id, version);

COMMENT ON COLUMN estimation_items_history.version IS 
  'Version number for this item within the estimation. Increments with each edit.';
```

---

### Phase 2: Backend Changes

#### File: `/app/app/api/projects/[id]/estimations/route.js`

**Current Flow (WRONG):**
```javascript
POST /estimations:
  1. Get max version number
  2. Mark old estimations inactive
  3. CREATE NEW estimation (version++)
  4. Insert items into new estimation
```

**New Flow (CORRECT):**
```javascript
POST /estimations (Create):
  1. Check if estimation exists for project
  2. If exists: Return error "Estimation already exists"
  3. If not: CREATE estimation
  4. Insert items
  
PUT /estimations/:id (Update):
  1. Check if estimation exists
  2. Get current max version from history
  3. Archive current items to history (version++)
  4. Delete current items
  5. INSERT new items
  6. UPDATE estimation totals and updated_at/updated_by
```

**Code Changes:**

```javascript
// NEW: POST creates estimation ONLY if none exists
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const body = await request.json();
  const { id: projectId } = params;

  try {
    await query("BEGIN");
    
    // 1. Check if estimation already exists
    const existingResult = await query(`
      SELECT id FROM project_estimations
      WHERE project_id = $1
    `, [projectId]);
    
    if (existingResult.rows.length > 0) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: 'Estimation already exists for this project. Use PUT to update.',
        estimation_id: existingResult.rows[0].id
      }, { status: 400 });
    }
    
    // 2. Create NEW estimation (first time only)
    const result = await query(`
      INSERT INTO project_estimations (
        project_id, created_by, created_at,
        items_value, kg_charges, discount, gst_amount, final_value,
        remarks
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      projectId, session.user.id,
      itemsValue, kgCharges, discount, gstAmount, finalValue,
      remarks
    ]);
    
    // 3. Insert items
    for (const item of body.items) {
      await query(`
        INSERT INTO estimation_items (
          estimation_id, stable_item_id, category, item_name, quantity, ...,
          created_at, created_by, updated_at, updated_by
        ) VALUES ($1, $2, $3, $4, $5, ..., NOW(), $6, NOW(), $6)
      `, [result.rows[0].id, null, item.category, ..., session.user.id]);
    }
    
    await query("COMMIT");
    return NextResponse.json({ estimation: result.rows[0] });
    
  } catch (error) {
    await query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// NEW: PUT updates existing estimation
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  const body = await request.json();
  const { id: projectId } = params;

  try {
    await query("BEGIN");
    
    // 1. Get existing estimation
    const estimationResult = await query(`
      SELECT id FROM project_estimations
      WHERE project_id = $1
    `, [projectId]);
    
    if (estimationResult.rows.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: 'Estimation not found. Use POST to create.'
      }, { status: 404 });
    }
    
    const estimationId = estimationResult.rows[0].id;
    
    // 2. Get current max version from history
    const versionResult = await query(`
      SELECT COALESCE(MAX(version), 0) as max_version
      FROM estimation_items_history
      WHERE estimation_id = $1
    `, [estimationId]);
    
    const nextVersion = versionResult.rows[0].max_version + 1;
    
    // 3. Fetch old items (for preserving created_at/created_by)
    const oldItemsResult = await query(`
      SELECT stable_item_id, created_at, created_by
      FROM estimation_items
      WHERE estimation_id = $1
    `, [estimationId]);
    
    let oldItemsMap = new Map();
    oldItemsResult.rows.forEach(item => {
      oldItemsMap.set(item.stable_item_id, {
        created_at: item.created_at,
        created_by: item.created_by
      });
    });
    
    // 4. Archive current items to history with version
    await query(`
      INSERT INTO estimation_items_history (
        id, stable_item_id, estimation_id, category, item_name, ...,
        created_at, created_by, updated_at, updated_by,
        version, archived_at, archived_by
      )
      SELECT 
        id, stable_item_id, estimation_id, category, item_name, ...,
        created_at, created_by, updated_at, updated_by,
        $2, NOW(), $3
      FROM estimation_items
      WHERE estimation_id = $1
    `, [estimationId, nextVersion, session.user.id]);
    
    // 5. Delete current items
    await query(`
      DELETE FROM estimation_items
      WHERE estimation_id = $1
    `, [estimationId]);
    
    // 6. Insert new items
    for (const item of body.items) {
      const stableItemId = item.stable_item_id || null;
      
      // Preserve creation audit for existing items
      let createdAt, createdBy;
      if (stableItemId && oldItemsMap.has(stableItemId)) {
        const oldAudit = oldItemsMap.get(stableItemId);
        createdAt = oldAudit.created_at;
        createdBy = oldAudit.created_by;
      } else {
        createdAt = null;
        createdBy = session.user.id;
      }
      
      await query(`
        INSERT INTO estimation_items (
          estimation_id, stable_item_id, category, item_name, quantity, ...,
          created_at, created_by, updated_at, updated_by
        ) VALUES ($1, $2, $3, $4, $5, ..., COALESCE($6, NOW()), $7, NOW(), $8)
      `, [estimationId, stableItemId, ..., createdAt, createdBy, session.user.id]);
    }
    
    // 7. Update estimation totals and updated_at
    await query(`
      UPDATE project_estimations
      SET 
        items_value = $2,
        kg_charges = $3,
        discount = $4,
        gst_amount = $5,
        final_value = $6,
        remarks = $7,
        updated_at = NOW(),
        updated_by = $8
      WHERE id = $1
    `, [
      estimationId,
      itemsValue, kgCharges, discount, gstAmount, finalValue, remarks,
      session.user.id
    ]);
    
    await query("COMMIT");
    
    return NextResponse.json({
      message: 'Estimation updated successfully',
      estimation_id: estimationId,
      version: nextVersion
    });
    
  } catch (error) {
    await query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### Phase 3: Frontend Changes

#### File: `/app/app/projects/[id]/manage-estimation/page.js`

**Current:**
```javascript
// Always POSTs (creates new estimation)
const res = await fetch(`/api/projects/${projectId}/estimations`, {
  method: 'POST',
  body: JSON.stringify(data)
});
```

**New:**
```javascript
// Determine if creating or updating
const estimationId = estimation?.id;

let res;
if (estimationId) {
  // UPDATE existing estimation
  res = await fetch(`/api/projects/${projectId}/estimations`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, estimation_id: estimationId })
  });
} else {
  // CREATE new estimation
  res = await fetch(`/api/projects/${projectId}/estimations`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

---

## Data Flow Comparison

### Before (WRONG - Creating New Estimations):
```
User creates estimation:
  POST /estimations → Creates estimation (id=100, version=1, is_active=true)

User edits estimation:
  POST /estimations → Creates estimation (id=200, version=2, is_active=true)
                      Marks id=100 as is_active=false

User edits again:
  POST /estimations → Creates estimation (id=300, version=3, is_active=true)
                      Marks id=200 as is_active=false

Result:
  project_estimations: 3 records (100, 200, 300)
  estimation_items: Items in estimation 300 only
  estimation_items_history: Items from 100 and 200
```

### After (CORRECT - Editing Same Estimation):
```
User creates estimation:
  POST /estimations → Creates estimation (id=100)
  estimation_items: Items V1

User edits estimation:
  PUT /estimations → Updates estimation (id=100)
                     Archives items to history (version=1)
                     Inserts new items
  estimation_items: Items V2
  estimation_items_history: Items V1

User edits again:
  PUT /estimations → Updates estimation (id=100)
                     Archives items to history (version=2)
                     Inserts new items
  estimation_items: Items V3
  estimation_items_history: Items V1, V2

Result:
  project_estimations: 1 record (100)
  estimation_items: Current items (V3)
  estimation_items_history: All past versions (V1, V2)
```

---

## Benefits of New Approach

### 1. Matches PR Pattern ✅
```
Purchase Requests:
- Multiple PRs per project
- Each PR editable with item versioning
- No version column on PR

Estimations (after fix):
- ONE estimation per project
- Editable with item versioning
- No version column on estimation

Consistent!
```

### 2. Clearer Semantics ✅
```
Before: "Create new estimation version" (confusing - not a new estimation!)
After:  "Edit estimation" (clear - updating the same estimation)
```

### 3. Simpler Queries ✅
```
Before: 
SELECT * FROM project_estimations 
WHERE project_id = 1 AND is_active = true;

After:
SELECT * FROM project_estimations 
WHERE project_id = 1;
```

### 4. Less Data Redundancy ✅
```
Before: 3 estimation records with duplicate data (remarks, project_id, etc.)
After:  1 estimation record, updated each time
```

### 5. Better UX ✅
```
Before: User sees "Create Version 3" (confusing)
After:  User sees "Save Changes" (clear)
```

---

## Migration Checklist

### Database Migrations
- [ ] Migration 025: Remove version, is_active from project_estimations
- [ ] Migration 025: Add unique constraint on project_id
- [ ] Migration 025: Add updated_at, updated_by to project_estimations
- [ ] Migration 026: Add version to estimation_items_history

### Backend Changes
- [ ] Split POST (create) and PUT (update) logic
- [ ] POST: Check if estimation exists, reject if yes
- [ ] PUT: Archive with version, delete, re-insert
- [ ] PUT: Update estimation record (not create new)
- [ ] Remove is_active filters from queries
- [ ] Remove version logic from estimation creation

### Frontend Changes
- [ ] Detect if estimation exists
- [ ] Use PUT for editing existing estimation
- [ ] Use POST only for first-time creation
- [ ] Update UI text: "Save" instead of "Create Version"

### Testing
- [ ] Create first estimation (POST)
- [ ] Try creating again (should fail)
- [ ] Edit estimation (PUT) - verify version 1 in history
- [ ] Edit again (PUT) - verify version 2 in history
- [ ] Verify only 1 estimation record exists
- [ ] Verify item history has all versions

---

## Rollback Plan

If issues found:
1. Keep new PUT endpoint
2. Temporarily allow POST to update (backward compatibility)
3. Gradually migrate frontend to use PUT
4. Eventually remove POST update logic

---

## Recommendation

✅ **Proceed with this approach**

**Why:**
1. Matches PR pattern (consistency)
2. Correct semantics (one estimation per project)
3. Cleaner data model (less redundancy)
4. Better UX (clear "edit" vs "create")
5. Simpler queries (no is_active filter)

**Effort:** 3-4 hours
- Migrations: 1 hour
- Backend refactor: 1-2 hours
- Frontend update: 30 min - 1 hour
- Testing: 1 hour

**Ready to implement when approved!**
