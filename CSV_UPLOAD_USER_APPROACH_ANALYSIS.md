# CSV Upload Feature - User's Simplified Approach Analysis

## User's Proposed Implementation

### Key Changes from Previous Analysis

#### 1. No `current_version` Column in Projects Table ✅
**Reasoning:**
- Latest version = MAX(version) from project_estimations WHERE project_id = X
- Simpler query: `SELECT MAX(version) FROM project_estimations WHERE project_id = ?`
- No need to maintain sync between projects.current_version and project_estimations

**Benefits:**
- ✅ One less column to maintain
- ✅ No foreign key constraint complexity
- ✅ Source of truth is project_estimations table only
- ✅ Simpler logic

---

## Detailed Workflow Analysis

### Step 1: Upload CSV Page
**Route:** `/app/projects/upload/[id]/page.js` (NEW PAGE)

**UI Components:**
```
┌─────────────────────────────────────────────┐
│ Upload Estimation CSV                       │
│ Project: Modern Villa Interior              │
├─────────────────────────────────────────────┤
│ Step 1: Download Template                   │
│ [📄 Download CSV Template]                  │
│                                             │
│ Step 2: Upload Your CSV                     │
│ [Drag & Drop or Browse]                     │
│                                             │
│ [Cancel] [Upload & Validate]               │
└─────────────────────────────────────────────┘
```

**After Upload (Validation Preview):**
```
┌─────────────────────────────────────────────┐
│ CSV Validation Results                      │
├─────────────────────────────────────────────┤
│ ✅ 45 valid rows                             │
│ ⚠️ 3 warnings                                │
│ ❌ 2 errors (must fix before proceeding)    │
├─────────────────────────────────────────────┤
│ [Read-only Table with Validation Status]   │
│                                             │
│ Row | Category | Room | Item | Qty | Status│
│  1  | Woodwork | LR   | TV   | 1   | ✅    │
│  2  | Misc     | BR   | AC   | 2   | ⚠️    │
│  3  | Shopping | Kit  | Sink | 1   | ❌    │
│ ...                                         │
├─────────────────────────────────────────────┤
│ Errors:                                     │
│ Row 3: Invalid category "Shopping123"      │
│ Row 15: Quantity must be > 0                │
│                                             │
│ Warnings:                                   │
│ Row 2: Width/Height missing for sqft unit  │
│ ...                                         │
├─────────────────────────────────────────────┤
│ [Cancel] [Fix & Re-upload] [✓ Confirm]     │
│ Note: Confirm is disabled if errors exist   │
└─────────────────────────────────────────────┘
```

**State Management:**
```javascript
const [csvFile, setCsvFile] = useState(null);
const [parsedData, setParsedData] = useState([]);
const [validationResults, setValidationResults] = useState({
  valid: [],
  warnings: [],
  errors: []
});
const [isValidating, setIsValidating] = useState(false);
const [canConfirm, setCanConfirm] = useState(false);
```

---

### Step 2: API - Upload & Process CSV
**Endpoint:** `POST /api/projects/[id]/upload/route.js` (NEW API)

**Request:**
```javascript
POST /api/projects/123/upload

Headers:
  Content-Type: multipart/form-data

Body:
  file: <CSV file>
```

**Processing Logic:**
```javascript
BEGIN TRANSACTION;

1. Get next version number:
   const maxVersionResult = await query(`
     SELECT COALESCE(MAX(version), 0) as max_version
     FROM project_estimations
     WHERE project_id = $1
   `, [projectId]);
   const nextVersion = maxVersionResult.rows[0].max_version + 1;

2. Save CSV file:
   const filePath = `uploads/estimations/${projectId}/v${nextVersion}_upload.csv`;
   await saveFile(file, filePath);

3. Parse CSV:
   const rows = parseCSV(file);

4. Validate all rows:
   const validationResults = validateRows(rows, project, bizModel);
   
   if (validationResults.errors.length > 0) {
     ROLLBACK;
     return { success: false, errors: validationResults.errors };
   }

5. Create project_estimations record:
   const estimation = await query(`
     INSERT INTO project_estimations (
       project_id, version, source, csv_file_path, 
       uploaded_by, is_active, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id
   `, [
     projectId, 
     nextVersion, 
     'csv_upload', 
     filePath,
     session.user.id,
     true,
     'draft'
   ]);

6. Mark all previous versions as inactive:
   await query(`
     UPDATE project_estimations
     SET is_active = false
     WHERE project_id = $1 AND id != $2
   `, [projectId, estimation.rows[0].id]);

7. Insert estimation_items:
   for (const row of rows) {
     const calculatedItem = calculateItemTotal(row, baseRates);
     
     await query(`
       INSERT INTO estimation_items (
         estimation_id, category, room_name, item_name,
         quantity, unit, rate, width, height,
         item_discount_percentage, discount_kg_charges_percentage,
         subtotal, karighar_charges_amount, item_discount_amount,
         discount_kg_charges_amount, amount_before_gst,
         gst_amount, item_total
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     `, [estimation.rows[0].id, calculatedItem.category, ...]);
   }

8. Calculate totals:
   const totals = calculateTotals(rows);

9. Update project_estimations with totals:
   await query(`
     UPDATE project_estimations
     SET category_breakdown = $1,
         items_value = $2,
         items_discount = $3,
         kg_charges = $4,
         kg_charges_discount = $5,
         gst_amount = $6,
         final_value = $7,
         status = 'active'
     WHERE id = $8
   `, [
     JSON.stringify(totals.category_breakdown),
     totals.items_value,
     totals.items_discount,
     totals.kg_charges,
     totals.kg_charges_discount,
     totals.gst_amount,
     totals.final_value,
     estimation.rows[0].id
   ]);

COMMIT;

return {
  success: true,
  version: nextVersion,
  estimation_id: estimation.rows[0].id,
  items_count: rows.length,
  final_value: totals.final_value
};
```

**Response:**
```javascript
// Success
{
  success: true,
  version: 1,
  estimation_id: 456,
  items_count: 45,
  final_value: 150000
}

// Validation Errors
{
  success: false,
  errors: [
    { row: 3, field: 'category', message: 'Invalid category' },
    { row: 15, field: 'quantity', message: 'Must be > 0' }
  ]
}

// Server Error
{
  success: false,
  error: 'Database error',
  message: 'Failed to process CSV'
}
```

---

### Step 3: Redirect to Project Details
**After successful upload:**
```javascript
// In upload page
const handleConfirm = async () => {
  const formData = new FormData();
  formData.append('file', csvFile);
  
  const res = await fetch(`/api/projects/${projectId}/upload`, {
    method: 'POST',
    body: formData
  });
  
  const result = await res.json();
  
  if (result.success) {
    toast.success(`Version ${result.version} created successfully!`);
    router.push(`/projects/${projectId}`);
  } else {
    toast.error('Upload failed');
    setValidationResults({ errors: result.errors });
  }
};
```

---

### Step 4: Project Details Page - Show Edit Button
**Location:** `/app/projects/[id]/page.js` (EXISTING PAGE - MODIFY)

**Logic to Show Edit Button:**
```javascript
// In useEffect
const fetchEstimations = async () => {
  const res = await fetch(`/api/projects/${projectId}/estimations/versions`);
  const data = await res.json();
  
  setVersions(data.versions);
  setHasEstimations(data.versions.length > 0);
  setLatestVersion(data.versions.length > 0 ? data.versions[0].version : null);
};

// UI Rendering
{!hasEstimations ? (
  // No estimation yet
  <Card>
    <CardHeader>
      <CardTitle>Estimation</CardTitle>
      <CardDescription>No estimation uploaded yet</CardDescription>
    </CardHeader>
    <CardContent>
      <Link href={`/projects/${projectId}/upload`}>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload CSV
        </Button>
      </Link>
      <Button variant="outline" onClick={downloadTemplate}>
        <FileDown className="mr-2 h-4 w-4" />
        Download Template
      </Button>
    </CardContent>
  </Card>
) : (
  // Estimation exists
  <Card>
    <CardHeader>
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Estimation - Version {selectedVersion || latestVersion}</CardTitle>
          <CardDescription>
            {versions.find(v => v.version === (selectedVersion || latestVersion))?.items_count} items | 
            ₹{formatCurrency(versions.find(v => v.version === (selectedVersion || latestVersion))?.final_value)}
          </CardDescription>
        </div>
        
        {/* Version Dropdown */}
        <Select value={selectedVersion?.toString() || latestVersion?.toString()} onValueChange={handleVersionChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {versions
              .sort((a, b) => b.version - a.version) // DESC order
              .map(v => (
                <SelectItem key={v.version} value={v.version.toString()}>
                  v{v.version} - {v.source === 'csv_upload' ? '📤 CSV' : '✏️ Edit'} 
                  {v.version === latestVersion && ' (Latest)'}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex gap-2">
        {/* Edit button - only for latest version */}
        <Link href={`/projects/${projectId}/manage-estimation?version=${latestVersion}`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit Estimation
          </Button>
        </Link>
        
        {/* Upload new CSV */}
        <Link href={`/projects/${projectId}/upload`}>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload New CSV
          </Button>
        </Link>
        
        {/* Download current version CSV */}
        <Button variant="outline" onClick={() => downloadVersionCSV(selectedVersion || latestVersion)}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

### Step 5: Version Switching with Dropdown
**Implementation in Project Details:**

```javascript
const [selectedVersion, setSelectedVersion] = useState(null); // null = latest
const [versions, setVersions] = useState([]);

const handleVersionChange = (versionStr) => {
  const version = parseInt(versionStr);
  setSelectedVersion(version);
  
  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('version', version);
  window.history.pushState({}, '', url);
  
  // Fetch items for this version to display
  fetchVersionItems(version);
};

const fetchVersionItems = async (version) => {
  const res = await fetch(`/api/projects/${projectId}/estimations/versions/${version}`);
  const data = await res.json();
  
  setEstimationItems(data.items);
  setEstimationTotals(data.totals);
};
```

**When User Clicks "Edit Estimation" from Project Page:**
```javascript
// Always goes to latest version
<Link href={`/projects/${projectId}/manage-estimation`}>
  <Button>Edit Estimation</Button>
</Link>

// In manage-estimation page
useEffect(() => {
  const version = searchParams.get('version');
  
  if (!version) {
    // No version specified = Load latest from DB
    loadLatestVersionFromDB();
  } else {
    // Version specified = Load from CSV (read-only)
    loadVersionFromCSV(version);
    setIsReadOnly(true);
  }
}, [searchParams]);
```

---

### Step 6: Edit Estimation - Latest Version Only
**Location:** `/app/projects/[id]/manage-estimation/page.js` (EXISTING PAGE - MODIFY)

**Loading Logic:**
```javascript
const [isReadOnly, setIsReadOnly] = useState(false);
const [currentVersion, setCurrentVersion] = useState(null);

useEffect(() => {
  const loadEstimation = async () => {
    // Get latest version
    const versionsRes = await fetch(`/api/projects/${projectId}/estimations/versions`);
    const versionsData = await versionsRes.json();
    const latestVersion = versionsData.versions[0]; // First in DESC order
    
    setCurrentVersion(latestVersion.version);
    
    // Load items from DB for latest version
    const itemsRes = await fetch(`/api/projects/${projectId}/estimations/${latestVersion.id}/items`);
    const itemsData = await itemsRes.json();
    
    setData(itemsData.items);
    setIsReadOnly(false); // Enable editing for latest version
  };
  
  loadEstimation();
}, [projectId]);
```

**Save Button:**
```javascript
<Button 
  type="submit" 
  disabled={isReadOnly || saving}
>
  {isReadOnly ? '🔒 Read-Only Mode' : '💾 Save Changes'}
</Button>
```

---

### Step 7: Viewing Old Version (Read-Only)
**When User Selects Old Version from Dropdown:**

**Option A: From Project Details Page**
```javascript
// User selects v1 from dropdown in project details page
handleVersionChange(1);

// Shows items in project details page itself (read-only table)
// "Edit Estimation" button still points to latest version
```

**Option B: Navigate to Manage-Estimation with Version Parameter**
```javascript
// User clicks "View in Detail" button for old version
<Link href={`/projects/${projectId}/manage-estimation?version=1&readonly=true`}>
  <Button variant="outline">View Version 1</Button>
</Link>

// In manage-estimation page
const version = searchParams.get('version');
const readonly = searchParams.get('readonly') === 'true';

if (version && readonly) {
  // Load from CSV file
  const csvRes = await fetch(`/api/projects/${projectId}/estimations/versions/${version}/csv`);
  const csvData = await csvRes.json();
  
  setData(csvData.items);
  setIsReadOnly(true);
  
  // Show banner
  <Alert>
    <Info className="h-4 w-4" />
    <AlertTitle>Viewing Version {version} (Archived)</AlertTitle>
    <AlertDescription>
      This is a read-only view. To edit, download CSV, modify, and upload as new version.
    </AlertDescription>
  </Alert>
}
```

**Recommendation:** **Option A** is simpler - show items in project details page for old versions, reserve manage-estimation only for editing latest.

---

### Step 8: Load Items from CSV vs DB

**Key Difference:**
```javascript
// Latest Version (Editable)
const loadLatestVersion = async () => {
  // Load from estimation_items table (DB)
  const res = await fetch(`/api/projects/${projectId}/estimations/items`);
  const data = await res.json();
  setData(data.items); // These items have estimation_id
};

// Old Version (Read-Only)
const loadOldVersion = async (version) => {
  // Load from CSV file
  const res = await fetch(`/api/projects/${projectId}/estimations/versions/${version}/csv`);
  const data = await res.json();
  setData(data.items); // Parsed from CSV, no estimation_id
};
```

**API Endpoint for CSV Loading:**
```javascript
// GET /api/projects/[id]/estimations/versions/[version]/csv/route.js

export async function GET(request, { params }) {
  const projectId = params.id;
  const version = params.version;
  
  // Get csv_file_path from project_estimations
  const estRes = await query(`
    SELECT csv_file_path, id
    FROM project_estimations
    WHERE project_id = $1 AND version = $2
  `, [projectId, version]);
  
  if (estRes.rows.length === 0) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }
  
  const csvFilePath = estRes.rows[0].csv_file_path;
  
  // Check if it's an upload CSV or export CSV
  // For old versions, use export CSV if available, otherwise upload CSV
  let filePath = csvFilePath;
  if (!fs.existsSync(csvFilePath)) {
    // Try export CSV
    const exportPath = csvFilePath.replace('_upload.csv', '_export.csv');
    if (fs.existsSync(exportPath)) {
      filePath = exportPath;
    }
  }
  
  // Parse CSV and return items
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const parsedItems = parseCSV(csvContent);
  
  // Calculate totals
  const totals = calculateTotals(parsedItems);
  
  return NextResponse.json({
    items: parsedItems,
    totals: totals,
    source: 'csv',
    version: version
  });
}
```

---

### Step 9: Save Changes (Create New Version)
**When User Clicks Save in manage-estimation/page.js (Latest Version):**

**Process:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setSaving(true);
  
  BEGIN TRANSACTION;
  
  1. Get current latest version:
     const currentVersionRes = await query(`
       SELECT id, version, csv_file_path
       FROM project_estimations
       WHERE project_id = $1 AND is_active = true
     `, [projectId]);
     const currentVersion = currentVersionRes.rows[0];
  
  2. Export current version items to CSV:
     const currentItems = await query(`
       SELECT * FROM estimation_items WHERE estimation_id = $1
     `, [currentVersion.id]);
     
     const csvContent = generateCSV(currentItems.rows);
     const exportPath = `uploads/estimations/${projectId}/v${currentVersion.version}_export.csv`;
     fs.writeFileSync(exportPath, csvContent);
  
  3. Delete current version items from DB:
     await query(`
       DELETE FROM estimation_items WHERE estimation_id = $1
     `, [currentVersion.id]);
  
  4. Mark current version as inactive:
     await query(`
       UPDATE project_estimations
       SET is_active = false,
           csv_file_path = $1
       WHERE id = $2
     `, [exportPath, currentVersion.id]);
  
  5. Create new version (old version + 1):
     const newVersion = currentVersion.version + 1;
     
     const newEstimation = await query(`
       INSERT INTO project_estimations (
         project_id, version, source, is_active, status,
         uploaded_by, category_breakdown, items_value,
         items_discount, kg_charges, kg_charges_discount,
         gst_amount, final_value
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id
     `, [
       projectId,
       newVersion,
       'manual_edit',
       true,
       'active',
       session.user.id,
       JSON.stringify(totals.category_breakdown),
       totals.items_value,
       totals.items_discount,
       totals.kg_charges,
       totals.kg_charges_discount,
       totals.gst_amount,
       totals.final_value
     ]);
  
  6. Insert new items into estimation_items:
     for (const item of data) {
       await query(`
         INSERT INTO estimation_items (
           estimation_id, category, room_name, item_name,
           quantity, unit, rate, width, height,
           item_discount_percentage, discount_kg_charges_percentage,
           subtotal, karighar_charges_amount, item_discount_amount,
           discount_kg_charges_amount, amount_before_gst,
           gst_amount, item_total
         ) VALUES ($1, $2, $3, ...)
       `, [newEstimation.rows[0].id, item.category, ...]);
     }
  
  COMMIT;
  
  toast.success(`Version ${newVersion} saved successfully!`);
  router.push(`/projects/${projectId}`);
};
```

---

### Step 10: Upload New CSV from Project Details
**When User Clicks "Upload New CSV" Button:**

```javascript
// In project details page
<Link href={`/projects/${projectId}/upload`}>
  <Button variant="outline">
    <Upload className="mr-2 h-4 w-4" />
    Upload New CSV
  </Button>
</Link>

// Takes user to same upload page as Step 1
// Process is identical to initial upload
// System automatically:
  1. Gets next version (current max + 1)
  2. Exports current active version to CSV
  3. Marks current version as inactive
  4. Creates new version with uploaded CSV
```

**The upload API handles both cases:**
- Initial upload (no versions exist)
- Subsequent upload (versions exist)

---

## Simplified Database Schema

### No `current_version` in Projects Table ✅

**Query to Get Latest Version:**
```sql
SELECT id, version, is_active, final_value
FROM project_estimations
WHERE project_id = 123
ORDER BY version DESC
LIMIT 1;
```

**Query to Get Active Version:**
```sql
SELECT id, version, is_active, final_value
FROM project_estimations
WHERE project_id = 123 AND is_active = true;
```

**Both are equivalent because:**
- Only one version can have `is_active = true`
- Latest version is always the active version
- `MAX(version)` = active version

---

## Updated Database Schema

### `project_estimations` Table
```sql
-- Already exists, just add new columns
ALTER TABLE project_estimations
ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN source VARCHAR(20) DEFAULT 'manual_edit', -- 'csv_upload' or 'manual_edit'
ADD COLUMN csv_file_path TEXT,
ADD COLUMN uploaded_by INTEGER REFERENCES users(id),
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add unique constraint
ALTER TABLE project_estimations
ADD CONSTRAINT unique_project_version UNIQUE (project_id, version);

-- Indexes
CREATE INDEX idx_estimations_project_version ON project_estimations(project_id, version DESC);
CREATE INDEX idx_estimations_active ON project_estimations(project_id, is_active) WHERE is_active = true;
```

### `estimation_items` Table
```sql
-- No changes needed, already has estimation_id foreign key
```

### `projects` Table
```sql
-- No changes needed! ✅
-- No current_version column required
```

---

## API Endpoints Required

### 1. Upload CSV (Initial & Subsequent)
```
POST /api/projects/[id]/upload/route.js
- Handles both initial upload and new version upload
- Validates CSV
- Creates new version
- Processes items
```

### 2. Download Template
```
GET /api/projects/[id]/estimations/template/route.js
- Generates CSV template based on project's BizModel
```

### 3. List All Versions
```
GET /api/projects/[id]/estimations/versions/route.js
- Returns all versions in DESC order
```

### 4. Get Version Details
```
GET /api/projects/[id]/estimations/versions/[version]/route.js
- Returns estimation record for specific version
```

### 5. Load Version Items from CSV
```
GET /api/projects/[id]/estimations/versions/[version]/csv/route.js
- Reads CSV file and returns parsed items
```

### 6. Download Version CSV
```
GET /api/projects/[id]/estimations/versions/[version]/export/route.js
- Downloads CSV file (upload or export)
```

### 7. Get Latest Version Items (from DB)
```
GET /api/projects/[id]/estimations/items/route.js
- Returns items from estimation_items for active version
```

---

## Pages/Routes Required

### New Pages
1. `/app/projects/upload/[id]/page.js` - Upload CSV page

### Modified Pages
1. `/app/projects/[id]/page.js` - Add version dropdown, upload button logic
2. `/app/projects/[id]/manage-estimation/page.js` - Handle read-only mode, save logic

### New APIs
1. `/app/api/projects/[id]/upload/route.js` - Upload & process CSV
2. `/app/api/projects/[id]/estimations/template/route.js` - Download template
3. `/app/api/projects/[id]/estimations/versions/route.js` - List versions
4. `/app/api/projects/[id]/estimations/versions/[version]/route.js` - Get version details
5. `/app/api/projects/[id]/estimations/versions/[version]/csv/route.js` - Load from CSV
6. `/app/api/projects/[id]/estimations/versions/[version]/export/route.js` - Download CSV
7. `/app/api/projects/[id]/estimations/items/route.js` - Get latest items from DB

---

## Comparison with Previous Analysis

| Aspect | Previous Analysis | User's Approach | Winner |
|--------|-------------------|-----------------|--------|
| Projects table | Add current_version column | No change needed | ✅ User's |
| Latest version query | Read from column | MAX(version) query | ✅ User's |
| Version switching | Complex state management | Simple dropdown | ✅ User's |
| Old version display | Need separate view | Load from CSV | ✅ User's |
| Upload flow | Complex validation | Dedicated upload page | ✅ User's |
| Save logic | Complex versioning | Clear dump → create → insert | ✅ User's |

**User's approach is simpler and cleaner! ✅**

---

## Key Differences & Improvements

### 1. No `current_version` Column ✅
**Before:**
- Maintain sync between projects.current_version and project_estimations
- Foreign key constraints
- Risk of inconsistency

**After:**
- Single source of truth: project_estimations table
- Latest version = MAX(version) or WHERE is_active = true
- Simpler, less error-prone

### 2. Dedicated Upload Page ✅
**Before:**
- Modal-based upload in project details

**After:**
- Full page at `/projects/upload/:id`
- Better UX for validation preview
- More space for error display
- Clearer workflow

### 3. Version Dropdown in Project Details ✅
**Before:**
- Separate version history modal
- Complex navigation

**After:**
- Simple dropdown in project details header
- Instant switching
- Clear "Latest" indicator
- Simpler UX

### 4. Read-Only from CSV ✅
**Before:**
- Load old versions from DB
- Complex state management

**After:**
- Old versions already in CSV
- Just parse and display
- No DB queries needed
- Faster

### 5. Save Logic Clarity ✅
**Before:**
- Complex versioning logic
- Unclear data flow

**After:**
- Clear 3-step process:
  1. Dump current to CSV
  2. Delete from DB
  3. Create new version in DB
- Easy to understand and maintain

---

## Potential Issues & Solutions

### Issue 1: Loading Old Versions from CSV
**Concern:** CSV might not have all calculated fields

**Solution:**
- When exporting to CSV, include ALL fields (calculated ones too)
- When parsing CSV for old versions, recalculate if needed
- Store complete data in export CSV

### Issue 2: Large Version Count
**Concern:** Dropdown becomes unwieldy with 50+ versions

**Solution:**
- Show only recent 10 versions in dropdown
- Add "View All Versions" link to full history page
- Pagination in history view

### Issue 3: CSV File Deletion
**Concern:** What if CSV file is deleted from disk?

**Solution:**
- Regular backups
- Store CSV in database as BYTEA (optional)
- Regenerate from items if needed (for export CSVs)
- Show warning if CSV missing

### Issue 4: Concurrent Edits
**Concern:** Two users editing simultaneously

**Solution:**
- Add `updated_at` timestamp
- Check if version changed since page load
- Show conflict warning
- Force refresh before save

---

## Implementation Priority

### Phase 1: Upload Flow
1. Create upload page (`/projects/upload/[id]/page.js`)
2. Create upload API (`/api/projects/[id]/upload/route.js`)
3. CSV validation logic
4. Template download API

### Phase 2: Version Management
1. Add version column to project_estimations
2. Update project details page with version dropdown
3. Create versions list API
4. Create CSV loading API

### Phase 3: Edit & Save
1. Update manage-estimation page for latest version
2. Implement read-only mode for old versions
3. Implement save logic (dump → create → insert)
4. Test version transitions

### Phase 4: Polish
1. Add loading states
2. Add error handling
3. Add success messages
4. Add version download feature

---

## Questions Clarified ✅

| Question | Answer |
|----------|--------|
| Projects.current_version? | ✅ NOT NEEDED |
| Version query? | ✅ MAX(version) or is_active = true |
| Upload page? | ✅ Dedicated page at /projects/upload/:id |
| Old version display? | ✅ Load from CSV (read-only) |
| Edit button? | ✅ Always for latest version |
| Version switching? | ✅ Dropdown in project details |
| Save creates new version? | ✅ Yes, dump → delete → create |
| Upload new CSV? | ✅ Same flow as initial upload |

---

## Summary of Approach

### Workflow
```
1. Project Created → No estimations
2. Click "Upload CSV" → /projects/upload/:id page
3. Upload & Validate → Shows preview
4. Confirm → Creates Version 1
5. Redirect to project details
6. Can Edit (latest) or Upload New CSV
7. Edit & Save → Creates Version 2 (dumps V1 to CSV)
8. Version dropdown shows all versions (DESC)
9. Select old version → Shows read-only items from CSV
10. Latest version → Loads from DB (editable)
```

### Benefits
- ✅ Simpler schema (no current_version column)
- ✅ Clearer workflows
- ✅ Better UX with dedicated upload page
- ✅ Easier version switching with dropdown
- ✅ Clean separation: Latest (DB) vs Old (CSV)
- ✅ Straightforward save logic

---

**Status:** 📋 Analysis Complete - User's approach is cleaner and simpler!

**Ready for implementation when you give the go-ahead!**

