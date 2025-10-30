# Analysis: CSV Upload Feature for Estimation Items

## Current Requirement Analysis

### Proposed Workflow
```
1. Project Created → No estimations exist
2. User clicks "Upload CSV" → Selects CSV file
3. System creates version (1 or last_version + 1)
4. CSV stored at: uploads/estimations/<pid>/<version>.csv
5. Process CSV → Insert into estimation_items
6. Update project.current_estimation_version
7. "Edit Estimation" button becomes visible
8. On Edit & Save:
   8.1 Dump current items to CSV (current_version.csv)
   8.2 Create new version
   8.3 Repeat steps 3-7
```

---

## Database Schema Analysis

### Current Schema Issues

#### 1. Missing Table: `project_estimations_versions`
**Current Schema:**
- `project_estimations` - Main estimation record (1 per project)
- `estimation_items` - Items linked to estimation_id

**Required New Table:**
```sql
CREATE TABLE project_estimations_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Estimation totals for this version
    category_breakdown JSONB,
    items_value NUMERIC(12, 2),
    items_discount NUMERIC(12, 2),
    kg_charges NUMERIC(12, 2),
    kg_charges_discount NUMERIC(12, 2),
    gst_amount NUMERIC(12, 2),
    final_value NUMERIC(12, 2),
    
    -- Metadata
    source VARCHAR(20) DEFAULT 'csv_upload', -- 'csv_upload', 'manual_edit', 'import'
    csv_file_path TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'archived'
    remarks TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(project_id, version),
    CHECK (version > 0)
);

CREATE INDEX idx_estimations_versions_project ON project_estimations_versions(project_id);
CREATE INDEX idx_estimations_versions_active ON project_estimations_versions(project_id, status) WHERE status = 'active';
```

#### 2. Update `estimation_items` Table
**Current:**
```sql
CREATE TABLE estimation_items (
    id SERIAL PRIMARY KEY,
    estimation_id INTEGER REFERENCES project_estimations(id),
    ...
);
```

**Proposed:**
```sql
CREATE TABLE estimation_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- All existing columns...
    category VARCHAR(50),
    room_name VARCHAR(100),
    item_name TEXT,
    ...
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (project_id, version) REFERENCES project_estimations_versions(project_id, version) ON DELETE CASCADE
);

CREATE INDEX idx_estimation_items_version ON estimation_items(project_id, version);
```

#### 3. Update `projects` Table
**Add:**
```sql
ALTER TABLE projects 
ADD COLUMN current_estimation_version INTEGER DEFAULT NULL,
ADD CONSTRAINT fk_current_version 
    FOREIGN KEY (id, current_estimation_version) 
    REFERENCES project_estimations_versions(project_id, version);
```

---

## Improvements & Suggestions

### 🚨 Critical Issues

#### Issue 1: Relationship with `project_estimations` Table
**Problem:** Current requirement doesn't specify how `project_estimations` relates to versions.

**Suggestion A: Keep `project_estimations` as Summary (RECOMMENDED)**
```
project_estimations (1 per project - current active summary)
    ├── Always reflects current_estimation_version
    └── Updated when version changes

project_estimations_versions (multiple per project - history)
    ├── Version 1, 2, 3, ...
    └── Each version is immutable once created

estimation_items
    ├── Linked to (project_id, version)
    └── Query: WHERE project_id = X AND version = current_version
```

**Suggestion B: Remove `project_estimations`, Use Only Versions**
```
project_estimations_versions (replaces project_estimations)
    ├── Version 1, 2, 3, ...
    └── Active version marked by project.current_estimation_version

estimation_items
    ├── Linked to (project_id, version)
```

**Recommendation:** **Suggestion A** - Keep both tables for backward compatibility and query performance.

---

#### Issue 2: CSV Upload vs Manual Edit Conflict
**Problem:** Requirement says "Users cannot create estimation from UI" but step 7 says "User edits estimation and saves"

**Clarification Needed:**
1. Can users manually add/edit items in the UI after CSV upload?
2. If yes, should manual edits create a new version?
3. Should there be a "dirty" state before creating new version?

**Suggested Flow:**
```
Scenario A: CSV Upload Only
- Upload CSV → Version 1
- Upload new CSV → Version 2
- No manual editing allowed

Scenario B: CSV + Manual Editing
- Upload CSV → Version 1 (locked)
- Click "Edit" → Create Version 2 (draft) with copy of V1 items
- User edits items in UI
- Click "Save" → Finalize Version 2 (active), Archive V1
- Upload new CSV → Version 3

Scenario C: Hybrid (RECOMMENDED)
- Upload CSV → Version 1 (active)
- Edit items in UI → Mark as "modified"
- Save Changes → Dump to CSV, Create Version 2 (active), Archive V1
- Upload new CSV anytime → Create new version, mark as active
```

**Recommendation:** **Scenario C** - Most flexible, maintains audit trail.

---

#### Issue 3: Dumping Items to CSV on Edit
**Problem:** "7.1 Dump all current <version> items into <version>.csv"

**Issues:**
- Overwriting the original uploaded CSV loses the source
- CSV format might not match original (column order, formatting)
- Breaks audit trail if original CSV is replaced

**Improved Approach:**
```
uploads/estimations/<pid>/
    ├── v1_upload.csv (original uploaded file)
    ├── v1_export.csv (optional: system-generated export)
    ├── v2_upload.csv (if uploaded)
    ├── v2_export.csv (system-generated when moving from v2 to v3)
    └── ...

Naming Convention:
- v<N>_upload.csv - User uploaded
- v<N>_export.csv - System generated (when version changes)
```

**Benefits:**
- Preserves original uploads
- Clear distinction between source and export
- Better audit trail

---

### 📋 Feature Enhancements

#### Enhancement 1: CSV Validation
**Add Pre-validation Before Upload:**
```javascript
Validation Checks:
1. File Format:
   - Must be .csv
   - Max size: 10MB
   - Encoding: UTF-8

2. Required Columns:
   - category (must match BizModel categories)
   - room_name
   - item_name
   - quantity
   - unit (sqft, no, lumpsum)
   - rate
   - Optional: width, height, item_discount_percentage, etc.

3. Data Validation:
   - category exists in project's BizModel
   - quantity > 0
   - rate >= 0
   - unit is valid
   - Percentages within limits (max_item_discount_percentage)

4. Provide Preview:
   - Show first 10 rows
   - Display validation errors
   - Highlight issues
   - Ask for confirmation before processing
```

#### Enhancement 2: Version Comparison
**Add Version Diff Feature:**
```javascript
Compare Versions:
- Show what changed between V1 and V2
- Items added (green)
- Items removed (red)
- Items modified (yellow)
- Summary of changes (X items added, Y removed, Z modified)
```

#### Enhancement 3: Rollback Capability
**Allow Reverting to Previous Version:**
```javascript
Rollback Feature:
- View list of all versions
- Preview any version
- "Restore Version X" → Creates new version (copy of X)
- Maintains immutability (never delete old versions)
```

#### Enhancement 4: Partial CSV Upload
**Support Updating Specific Categories:**
```javascript
Upload Options:
1. Full Replacement (default) - Replace all items
2. Append - Add new items, keep existing
3. Update Category - Replace items for specific category only
```

---

### 🔧 Technical Improvements

#### Improvement 1: Transaction Safety
**Wrap Version Creation in Transaction:**
```javascript
BEGIN TRANSACTION;
  1. Create version record in project_estimations_versions
  2. Upload CSV file
  3. Parse and validate CSV
  4. Insert items into estimation_items
  5. Calculate totals
  6. Update version record with totals
  7. Update project.current_estimation_version
  8. Update project_estimations (if keeping it)
COMMIT;

If any step fails → ROLLBACK
```

#### Improvement 2: Background Processing
**For Large CSVs (1000+ rows):**
```javascript
Upload Flow:
1. User uploads CSV
2. Store in temp location
3. Create version record (status: 'processing')
4. Queue background job
5. Show progress indicator
6. Process in chunks (100 rows at a time)
7. Update status to 'active' when complete
8. Notify user (toast/email)
```

#### Improvement 3: CSV Template Download
**Provide Template:**
```javascript
Features:
- "Download CSV Template" button
- Pre-filled with:
  - Column headers (exact names required)
  - Sample row with valid data
  - Comments/instructions in first row
- Dynamically generated based on project's BizModel categories
```

---

### 🎨 UI/UX Improvements

#### UI Flow Suggestion

**Project Details Page:**
```
┌─────────────────────────────────────────────┐
│ Project: Modern Villa Interior              │
├─────────────────────────────────────────────┤
│ Estimation Status: No estimation yet        │
│                                             │
│ [📤 Upload CSV] [📄 Download Template]      │
└─────────────────────────────────────────────┘

After First Upload:
┌─────────────────────────────────────────────┐
│ Estimation: Version 2 (Active)              │
│ Last Updated: 2 days ago by John Doe        │
│                                             │
│ [✏️ Edit Estimation] [📤 Upload New CSV]    │
│ [📊 View History] [📄 Export Current]       │
└─────────────────────────────────────────────┘

Version History Modal:
┌─────────────────────────────────────────────┐
│ Version History                       [×]   │
├─────────────────────────────────────────────┤
│ ● V2 - Active (2 days ago)                  │
│   Source: Manual Edit                       │
│   Items: 45 | Total: ₹1,50,000            │
│   [View] [Export] [Compare with V1]        │
│                                             │
│ ○ V1 - Archived (5 days ago)                │
│   Source: CSV Upload (v1_upload.csv)        │
│   Items: 42 | Total: ₹1,45,000            │
│   [View] [Export] [Restore]                │
└─────────────────────────────────────────────┘
```

#### CSV Upload Modal
```
┌─────────────────────────────────────────────┐
│ Upload Estimation CSV               [×]     │
├─────────────────────────────────────────────┤
│ [Drag & Drop CSV here or Browse]            │
│                                             │
│ ✓ Supports .csv files only                  │
│ ✓ Max 10MB                                  │
│ ✓ Download template for format             │
│                                             │
│ [📄 Download Template]                      │
│                                             │
│ Upload Mode:                                │
│ ○ Full Replacement (replace all items)     │
│ ○ Append (add to existing items)           │
│                                             │
│ [Cancel] [Upload & Preview]                │
└─────────────────────────────────────────────┘

Preview After Upload:
┌─────────────────────────────────────────────┐
│ CSV Preview - Validation Results    [×]     │
├─────────────────────────────────────────────┤
│ ✅ 45 valid rows                             │
│ ⚠️ 3 warnings (hover for details)           │
│ ❌ 2 errors (must fix)                       │
│                                             │
│ [Table showing first 10 rows with validation]│
│                                             │
│ This will create Version 3                 │
│ Version 2 will be archived                  │
│                                             │
│ [Cancel] [Fix Errors] [✓ Confirm Upload]   │
└─────────────────────────────────────────────┘
```

---

### 📁 File Storage Structure

**Improved Directory Structure:**
```
uploads/
└── estimations/
    └── <project_id>/
        ├── versions/
        │   ├── v1_upload.csv (original upload)
        │   ├── v1_export.csv (system export)
        │   ├── v2_upload.csv
        │   ├── v2_export.csv
        │   └── ...
        ├── temp/
        │   └── upload_<timestamp>.csv (during processing)
        └── metadata.json (optional - version info)
```

**File Naming Convention:**
```
v<version>_<type>_<timestamp>.csv

Examples:
- v1_upload_20250615123045.csv
- v1_export_20250616093022.csv
- v2_upload_20250618141533.csv
```

---

### 🔐 Security & Validation

#### Security Measures
```javascript
1. File Upload Security:
   - Validate MIME type (text/csv)
   - Scan for malicious content
   - Limit file size (10MB)
   - Sanitize filename
   - Store outside web root

2. CSV Parsing Security:
   - Prevent CSV injection
   - Escape special characters
   - Validate all data types
   - Limit rows (max 10,000)

3. Access Control:
   - Only project members can upload
   - Estimator role required
   - Audit log all uploads
```

---

### 🔄 API Endpoints Design

#### New Endpoints Needed:

```javascript
1. POST /api/projects/:id/estimations/upload
   Body: { file: CSV, mode: 'replace'|'append' }
   Response: { version, status: 'processing', job_id }

2. GET /api/projects/:id/estimations/versions
   Response: [{ version, status, created_at, items_count, total }]

3. GET /api/projects/:id/estimations/versions/:version
   Response: { version, items[], totals }

4. GET /api/projects/:id/estimations/versions/:version/export
   Response: CSV file download

5. POST /api/projects/:id/estimations/versions/:version/restore
   Response: { new_version }

6. GET /api/projects/:id/estimations/versions/compare
   Query: ?from=1&to=2
   Response: { added: [], removed: [], modified: [] }

7. GET /api/projects/:id/estimations/template
   Response: CSV template file

8. GET /api/projects/:id/estimations/upload/validate
   Body: { file: CSV }
   Response: { valid: true, errors: [], warnings: [] }
```

---

### ⚡ Performance Optimization

#### Chunked Processing for Large CSVs:
```javascript
Processing Strategy:
1. Upload CSV → Store in temp location
2. Parse in chunks (100 rows at a time)
3. Validate each chunk
4. Insert each chunk in batch
5. Update progress (frontend polling or WebSocket)
6. Calculate totals after all chunks complete

Benefits:
- Handles 10,000+ row CSVs
- Prevents timeout
- Shows progress
- Can resume if interrupted
```

---

### 🧪 Testing Checklist

```
Manual Testing:
□ Upload valid CSV → Version 1 created
□ Upload CSV with errors → Show validation errors
□ Upload CSV with warnings → Allow with confirmation
□ Edit items in UI → Mark as modified
□ Save edited items → Version 2 created, V1 archived
□ Upload new CSV → Version 3 created
□ View version history
□ Compare versions
□ Restore old version → Creates new version (copy)
□ Export any version to CSV
□ Download template → Correct format

Edge Cases:
□ Upload empty CSV
□ Upload CSV with no items
□ Upload CSV with duplicate items
□ Upload CSV with invalid categories
□ Upload CSV with special characters
□ Upload very large CSV (10K rows)
□ Upload while processing another
□ Network failure during upload
□ User navigates away during processing
```

---

## Migration Strategy

### Phase 1: Database Schema
1. Create `project_estimations_versions` table
2. Add `current_estimation_version` to `projects`
3. Update `estimation_items` to reference (project_id, version)
4. Migrate existing data:
   - Create V1 for all existing estimations
   - Update project.current_estimation_version

### Phase 2: File Storage
1. Create uploads directory structure
2. Export existing estimations to CSV (V1)
3. Update file paths in database

### Phase 3: API Development
1. CSV upload endpoint
2. Validation endpoint
3. Version management endpoints
4. Export endpoints

### Phase 4: UI Development
1. Upload button & modal
2. Version history view
3. Edit estimation page (refactored)
4. Progress indicators

---

## Final Recommendations

### Must-Have Features:
1. ✅ Version tracking with immutable history
2. ✅ CSV validation before processing
3. ✅ Transaction safety (rollback on error)
4. ✅ Preserve original uploaded CSVs
5. ✅ Export capability for any version
6. ✅ Clear distinction between upload and export files

### Nice-to-Have Features:
1. 🔵 Version comparison (diff)
2. 🔵 Background processing for large CSVs
3. 🔵 Rollback/restore capability
4. 🔵 Partial CSV upload (category-specific)
5. 🔵 CSV template generation

### Critical Questions to Answer:
1. **Should `project_estimations` table remain?**
   - Recommendation: Yes, as active version summary

2. **Can users manually edit after CSV upload?**
   - Recommendation: Yes, with versioning

3. **Should original CSV be overwritten on edit?**
   - Recommendation: No, create separate export files

4. **Max CSV size and row count?**
   - Recommendation: 10MB, 10,000 rows

5. **Background processing or synchronous?**
   - Recommendation: Synchronous for <1000 rows, background for larger

---

## Estimated Complexity

| Component | Complexity | Time Estimate |
|-----------|-----------|---------------|
| Database Schema | Medium | 2-3 hours |
| CSV Upload API | High | 4-6 hours |
| Validation Logic | Medium | 3-4 hours |
| Version Management | High | 4-6 hours |
| UI Components | High | 6-8 hours |
| Testing | Medium | 4-5 hours |
| **Total** | **High** | **23-32 hours** |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large CSV timeout | High | Background processing |
| Invalid CSV data | Medium | Pre-validation |
| Version conflicts | Low | Transaction locks |
| File storage limits | Medium | Cleanup old exports |
| Backward compatibility | Medium | Migration script |

---

## Questions for User

1. Should users be able to edit estimations manually in UI after CSV upload?
2. What's the expected maximum CSV size (rows and MB)?
3. Should version comparison (diff) be included in MVP?
4. Do you want real-time progress for large CSV uploads?
5. Should old versions be auto-archived after X days?
6. Any specific CSV column naming requirements?

---

**Status:** 📋 Analysis Complete - Ready for feedback before implementation

