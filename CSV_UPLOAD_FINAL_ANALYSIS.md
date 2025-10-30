# CSV Upload Feature - Updated Analysis Based on User Feedback

## Clarifications Received ✅

### 1. Workflow
```
✅ CONFIRMED WORKFLOW:
1. New Project → No estimation exists
2. User MUST upload CSV first (cannot create from UI)
3. After CSV upload → User can:
   a. Edit items in UI
   b. Upload new CSV
4. Old versions are VIEW-ONLY:
   - User can switch to view old versions
   - SAVE button is DISABLED for old versions
   - Can download old version CSV
   - Can modify downloaded CSV
   - Can re-upload modified CSV as NEW version
```

### 2. CSV Size
```
✅ SMALL CSV:
- Columns: ~15
- Rows: ~1000
- Character limit: <100 per cell
- Estimated size: ~1.5MB max
- Conclusion: Synchronous upload is perfect
```

### 3. Features Scope
```
✅ NOT NEEDED (Remove from plan):
- Version comparison/diff
- Background processing
- Progress indicators
- Auto-archival

✅ NEEDED:
- CSV upload & validation
- Version management (view/switch)
- Edit capability after upload
- Download CSV for any version
- CSV template download
```

### 4. Database Design
```
✅ USER PREFERENCE:
- Add current_version column to projects table
- NO new project_estimations_versions table
- Use existing project_estimations table for versioning
- Keep original CSV files
```

---

## Updated Database Schema

### 1. Update `projects` Table
```sql
ALTER TABLE projects 
ADD COLUMN current_estimation_version INTEGER DEFAULT NULL;

-- Index for performance
CREATE INDEX idx_projects_current_version ON projects(id, current_estimation_version);
```

### 2. Update `project_estimations` Table
```sql
-- Add version column to existing table
ALTER TABLE project_estimations
ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN source VARCHAR(20) DEFAULT 'csv_upload', -- 'csv_upload' or 'manual_edit'
ADD COLUMN csv_file_path TEXT,
ADD COLUMN uploaded_by INTEGER REFERENCES users(id),
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Make (project_id, version) unique
ALTER TABLE project_estimations
ADD CONSTRAINT unique_project_version UNIQUE (project_id, version);

-- Index for querying versions
CREATE INDEX idx_estimations_project_version ON project_estimations(project_id, version);
CREATE INDEX idx_estimations_active ON project_estimations(project_id, is_active) WHERE is_active = true;
```

### 3. `estimation_items` Table (No changes needed)
```sql
-- Already has estimation_id reference
-- No changes required
```

---

## Simplified Architecture

### Data Model
```
projects
  ├── current_estimation_version (1, 2, 3, ...)
  └── 1:N → project_estimations (multiple versions)
              ├── version: 1, 2, 3, ...
              ├── is_active: true/false
              ├── csv_file_path: uploads/estimations/<pid>/v1_upload.csv
              └── 1:N → estimation_items
```

### Version States
```
Version 1: is_active = false, current_version = 3
Version 2: is_active = false, current_version = 3
Version 3: is_active = true, current_version = 3 (ACTIVE)

Rules:
- Only ONE version can have is_active = true per project
- project.current_estimation_version points to active version
- When viewing old version: SAVE button disabled
- When viewing active version: SAVE button enabled
```

---

## File Storage Structure

### Directory Layout
```
uploads/
└── estimations/
    └── <project_id>/
        ├── v1_upload.csv      (original upload - immutable)
        ├── v1_export.csv      (system export when moving to v2)
        ├── v2_upload.csv      (new upload or null if from edit)
        ├── v2_export.csv      (system export when moving to v3)
        ├── v3_upload.csv
        └── ...

File Types:
- v<N>_upload.csv:  User uploaded (immutable, keep forever)
- v<N>_export.csv:  System generated when version changes (for download)
```

### Naming Convention
```
Pattern: v<version>_<type>.csv

Examples:
- v1_upload.csv  → User uploaded version 1
- v1_export.csv  → System exported version 1 (when user moved to v2)
- v2_upload.csv  → User uploaded version 2
- v3_upload.csv  → User uploaded version 3
```

---

## Detailed Workflow

### Scenario 1: Initial CSV Upload
```
1. User creates project
   - project_estimations: empty
   - current_estimation_version: NULL

2. User clicks "Upload CSV"
   - Shows upload modal
   - User selects file

3. System validates CSV
   - Checks format, columns, data types
   - Shows preview if valid
   - Shows errors if invalid

4. User confirms upload
   BEGIN TRANSACTION:
     a. Create project_estimations record
        - version = 1
        - is_active = true
        - source = 'csv_upload'
        - csv_file_path = 'uploads/estimations/<pid>/v1_upload.csv'
     
     b. Save CSV file to uploads/estimations/<pid>/v1_upload.csv
     
     c. Parse CSV and insert rows into estimation_items
        - estimation_id = new estimation.id
        - Calculate totals
     
     d. Update project_estimations with totals
        - category_breakdown, final_value, etc.
     
     e. Update projects.current_estimation_version = 1
   COMMIT

5. UI updates
   - "Edit Estimation" button now visible
   - "View/Manage Versions" button visible
   - Shows estimation summary
```

### Scenario 2: Edit Existing Estimation (Manual Edit)
```
1. User views active version (v1)
   - SAVE button is ENABLED

2. User clicks "Edit Estimation"
   - Opens manage-estimation page
   - Loads items for current version
   - User modifies items (add/edit/delete)

3. User clicks "Save"
   BEGIN TRANSACTION:
     a. Export current version (v1) to CSV
        - Create uploads/estimations/<pid>/v1_export.csv
        - Update v1.csv_file_path to include export path
     
     b. Mark v1 as inactive
        - UPDATE project_estimations SET is_active = false WHERE id = v1_id
     
     c. Create new project_estimations record (v2)
        - version = 2
        - is_active = true
        - source = 'manual_edit'
        - csv_file_path = NULL (or point to v2_export.csv when created)
     
     d. Copy/insert new items into estimation_items
        - estimation_id = new estimation.id (v2)
        - Calculate totals
     
     e. Update projects.current_estimation_version = 2
   COMMIT

4. UI updates
   - Now viewing v2 (active)
   - v1 archived
```

### Scenario 3: Upload New CSV (Replace)
```
1. User viewing active version (v2)
   - Clicks "Upload New CSV"

2. User uploads CSV
   - System validates
   - Shows preview

3. User confirms
   BEGIN TRANSACTION:
     a. Export current version (v2) to CSV
        - Create uploads/estimations/<pid>/v2_export.csv
     
     b. Mark v2 as inactive
        - UPDATE project_estimations SET is_active = false WHERE id = v2_id
     
     c. Create new project_estimations record (v3)
        - version = 3
        - is_active = true
        - source = 'csv_upload'
        - csv_file_path = 'uploads/estimations/<pid>/v3_upload.csv'
     
     d. Save new CSV file
     
     e. Parse and insert items for v3
     
     f. Update projects.current_estimation_version = 3
   COMMIT
```

### Scenario 4: View Old Version (Read-Only)
```
1. User clicks "View Versions"
   - Modal shows list:
     ○ v1 (Archived) - 5 days ago - CSV Upload
     ○ v2 (Archived) - 2 days ago - Manual Edit
     ● v3 (Active)   - 1 hour ago - CSV Upload

2. User clicks "View v1"
   - Loads estimation_items WHERE estimation_id = v1_id
   - Shows items in read-only table/view
   - SAVE button is DISABLED (grayed out)
   - Shows banner: "Viewing Version 1 (Archived) - Read Only"

3. User actions:
   a. "Download CSV" → Downloads v1_upload.csv or v1_export.csv
   b. "Back to Active Version" → Returns to v3
   c. "Switch to this Version" → NOT ALLOWED (user must download & re-upload)
```

### Scenario 5: Restore Old Version (Download & Re-upload)
```
1. User viewing v1 (read-only)
   - Clicks "Download CSV"
   - Gets v1_export.csv or v1_upload.csv

2. User modifies downloaded CSV locally

3. User uploads modified CSV as new version
   - Follows Scenario 3 workflow
   - Creates v4 based on modified v1
```

---

## CSV Format Specification

### Required Columns
```
1.  category          (must match BizModel categories)
2.  room_name         (required)
3.  item_name         (required)
4.  quantity          (number > 0)
5.  unit              (sqft, no, lumpsum)
6.  rate              (number >= 0)
7.  width             (optional for sqft)
8.  height            (optional for sqft)
9.  item_discount_percentage      (optional, within limits)
10. discount_kg_charges_percentage (optional, within limits)

Optional calculated fields (can be provided or auto-calculated):
11. subtotal
12. karighar_charges_percentage
13. karighar_charges_amount
14. item_discount_amount
15. discount_kg_charges_amount
```

### Sample CSV Template
```csv
category,room_name,item_name,quantity,unit,rate,width,height,item_discount_percentage,discount_kg_charges_percentage
woodwork,Living Room,Modular TV Unit,1,no,45000,0,0,5,10
woodwork,Master Bedroom,Wardrobe,120,sqft,850,10,12,0,0
misc,Kitchen,False Ceiling,80,sqft,180,10,8,0,5
shopping,Living Room,Sofa Set,1,lumpsum,75000,0,0,0,0
```

---

## API Endpoints Required

### 1. Upload CSV
```javascript
POST /api/projects/:id/estimations/upload

Headers:
  Content-Type: multipart/form-data

Body:
  file: <CSV file>

Response:
  {
    success: true,
    version: 3,
    estimation_id: 123,
    items_count: 45,
    final_value: 150000
  }

Errors:
  - 400: Invalid CSV format
  - 400: Validation errors (with details)
  - 413: File too large
```

### 2. Download CSV Template
```javascript
GET /api/projects/:id/estimations/template

Response:
  - CSV file download with headers and sample rows
  - Headers based on project's BizModel categories
```

### 3. Download Version CSV
```javascript
GET /api/projects/:id/estimations/:version/export

Response:
  - CSV file download
  - Filename: project_<pid>_v<version>.csv
```

### 4. Get Version List
```javascript
GET /api/projects/:id/estimations/versions

Response:
  {
    versions: [
      {
        id: 1,
        version: 1,
        is_active: false,
        source: 'csv_upload',
        items_count: 42,
        final_value: 145000,
        created_at: '2025-06-10T10:00:00Z',
        created_by: 'John Doe',
        csv_available: true
      },
      {
        id: 2,
        version: 2,
        is_active: false,
        source: 'manual_edit',
        items_count: 45,
        final_value: 148000,
        created_at: '2025-06-12T14:30:00Z',
        created_by: 'Jane Smith',
        csv_available: true
      },
      {
        id: 3,
        version: 3,
        is_active: true,
        source: 'csv_upload',
        items_count: 50,
        final_value: 155000,
        created_at: '2025-06-15T09:00:00Z',
        created_by: 'John Doe',
        csv_available: true
      }
    ],
    current_version: 3
  }
```

### 5. Get Version Details
```javascript
GET /api/projects/:id/estimations/versions/:version

Response:
  {
    estimation: { id, version, is_active, source, ... },
    items: [ {...}, {...} ],
    totals: { category_breakdown, final_value, ... }
  }
```

### 6. Validate CSV (Pre-upload check)
```javascript
POST /api/projects/:id/estimations/validate

Body:
  file: <CSV file>

Response:
  {
    valid: true,
    warnings: [],
    errors: [],
    preview: [ {row: 1, data: {...}}, ... ] // First 10 rows
  }

OR

  {
    valid: false,
    warnings: ['Column "width" missing for 5 sqft items'],
    errors: [
      { row: 10, field: 'category', message: 'Invalid category "furniture"' },
      { row: 15, field: 'quantity', message: 'Must be greater than 0' }
    ],
    preview: []
  }
```

---

## UI Changes Required

### 1. Project Details Page
```
When no estimation exists:
┌─────────────────────────────────────────┐
│ Estimation                              │
├─────────────────────────────────────────┤
│ ⚠️ No estimation uploaded yet           │
│                                         │
│ [📤 Upload CSV] [📄 Download Template]  │
└─────────────────────────────────────────┘

After estimation exists:
┌─────────────────────────────────────────┐
│ Estimation - Version 3 (Active)         │
│ 50 items | ₹1,55,000 | Updated 1h ago  │
├─────────────────────────────────────────┤
│ [✏️ Edit] [📤 Upload New] [📊 Versions] │
│ [📥 Download CSV] [📄 Template]         │
└─────────────────────────────────────────┘
```

### 2. Version History Modal
```
┌─────────────────────────────────────────┐
│ Version History                   [×]   │
├─────────────────────────────────────────┤
│ ● v3 - Active (1 hour ago)              │
│   Source: CSV Upload                    │
│   Items: 50 | Total: ₹1,55,000         │
│   By: John Doe                          │
│   [View] [Download CSV]                 │
│                                         │
│ ○ v2 - Archived (2 days ago)            │
│   Source: Manual Edit                   │
│   Items: 45 | Total: ₹1,48,000         │
│   By: Jane Smith                        │
│   [View] [Download CSV]                 │
│                                         │
│ ○ v1 - Archived (5 days ago)            │
│   Source: CSV Upload                    │
│   Items: 42 | Total: ₹1,45,000         │
│   By: John Doe                          │
│   [View] [Download CSV]                 │
└─────────────────────────────────────────┘
```

### 3. Manage Estimation Page
```
When viewing ACTIVE version:
┌─────────────────────────────────────────┐
│ Edit Estimation - Version 3 (Active)    │
│ [← Back] [💾 Save Changes]              │
├─────────────────────────────────────────┤
│ [Category-based tables with edit UI]   │
└─────────────────────────────────────────┘

When viewing OLD version:
┌─────────────────────────────────────────┐
│ View Estimation - Version 1 (Archived)  │
│ 📋 READ-ONLY MODE                       │
│ [← Back] [💾 Save Changes] (DISABLED)   │
│ [📥 Download CSV to Edit]               │
├─────────────────────────────────────────┤
│ [Category-based tables - read-only]    │
└─────────────────────────────────────────┘
```

---

## Migration Strategy

### Step 1: Database Schema Updates
```sql
-- Add version support to existing tables
ALTER TABLE projects ADD COLUMN current_estimation_version INTEGER;
ALTER TABLE project_estimations ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE project_estimations ADD COLUMN source VARCHAR(20) DEFAULT 'manual_edit';
ALTER TABLE project_estimations ADD COLUMN csv_file_path TEXT;
ALTER TABLE project_estimations ADD COLUMN uploaded_by INTEGER REFERENCES users(id);
ALTER TABLE project_estimations ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add constraints
ALTER TABLE project_estimations 
ADD CONSTRAINT unique_project_version UNIQUE (project_id, version);

-- Migrate existing data
UPDATE project_estimations SET version = 1, is_active = true;
UPDATE projects p SET current_estimation_version = 1 
WHERE EXISTS (SELECT 1 FROM project_estimations pe WHERE pe.project_id = p.id);
```

### Step 2: File System Preparation
```bash
# Create uploads directory
mkdir -p /app/uploads/estimations

# Set permissions
chmod 755 /app/uploads/estimations
```

---

## Validation Rules

### CSV Structure Validation
```javascript
1. File Format:
   - Must be .csv extension
   - UTF-8 encoding
   - Max size: 10MB (for ~1000 rows, plenty of headroom)

2. Required Headers (case-insensitive):
   - category, room_name, item_name, quantity, unit, rate

3. Optional Headers:
   - width, height, item_discount_percentage, discount_kg_charges_percentage

4. Row Validation:
   - All required fields must have values
   - quantity > 0
   - rate >= 0
   - unit in ['sqft', 'no', 'lumpsum']
   - category must exist in project's BizModel
   - If unit = 'sqft', width and height should be provided
   - discount percentages within limits (from category config)
```

### Data Validation
```javascript
For each row:
1. Category Check:
   - Must match one of project's BizModel categories
   - Case-insensitive comparison

2. Unit Check:
   - If unit = 'sqft':
     - quantity = width * height (or provided quantity)
     - width and height recommended
   - If unit = 'no' or 'lumpsum':
     - quantity from CSV

3. Discount Limits:
   - item_discount_percentage <= category.max_item_discount_percentage
   - discount_kg_charges_percentage <= category.max_kg_discount_percentage

4. Calculations:
   - Calculate all derived fields
   - Verify totals
```

---

## Questions Answered ✅

### 1. Can users manually edit after CSV upload?
✅ **YES** - After CSV upload, users can edit in UI or upload new CSV

### 2. Expected max CSV size?
✅ **~1.5MB** - 15 columns × 1000 rows × <100 chars

### 3. Include version comparison in MVP?
✅ **NO** - Not needed

### 4. Need real-time progress for uploads?
✅ **NO** - Synchronous upload for small files

### 5. Auto-archive old versions?
✅ **NO** - Manual switching only, no auto-archival

### 6. View-only for old versions?
✅ **YES** - Old versions are read-only, SAVE disabled
✅ User must download CSV, modify, and re-upload as new version

### 7. Database schema preference?
✅ **NO new table** - Use existing project_estimations with version column
✅ Add current_version to projects table

### 8. CSV file management?
✅ Keep original uploads (v<N>_upload.csv)
✅ Generate exports when version changes (v<N>_export.csv)

---

## Summary of Design

### Architecture
- Single `project_estimations` table with version column
- `projects.current_estimation_version` points to active version
- One active version per project (is_active = true)
- CSV files stored separately (upload + export)

### Workflow
- Initial: Must upload CSV
- After upload: Can edit OR upload new CSV
- Old versions: View-only (download → modify → re-upload)
- Version switching: UI allows viewing any version

### Scope
- Synchronous upload (no background processing)
- No version comparison
- No auto-archival
- Simple, clean implementation

---

## Ready for Implementation? ✅

**All Questions Answered:**
- Workflow: Clear
- File size: Known
- Features: Defined
- Schema: Simplified
- UI behavior: Specified

**Waiting for:**
- Your instructions on which pages/routes to start with
- Any final clarifications

---

**Status:** 📋 Analysis Complete - Ready for implementation instructions

