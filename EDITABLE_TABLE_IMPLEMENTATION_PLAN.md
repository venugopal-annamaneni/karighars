# Editable TanStack Table Implementation Plan

## Implementation Status: IN PROGRESS

This document outlines the complete implementation of the editable TanStack Table for manage-estimation/page.js

---

## ✅ Features to Implement

### Core Features:
1. ✅ TanStack Table setup with editable cells
2. ✅ Inline text inputs (room_name, description)
3. ✅ Inline select dropdowns (category, unit, vendor)
4. ✅ Inline number inputs (width, height, quantity, prices, percentages)
5. ✅ Conditional width/height display (only for sqft)
6. ✅ Auto-calculation (width × height = quantity)
7. ✅ Real-time item total calculation
8. ✅ Add row button
9. ✅ Delete row button
10. ✅ Save functionality with validation
11. ✅ Room/Category grouping
12. ✅ Expand/collapse groups

### Nice-to-Have Features:
13. ✅ Duplicate row button
14. ✅ Drag-and-drop row reordering (using @dnd-kit)
15. ✅ Undo/redo functionality (Ctrl+Z, Ctrl+Y)
16. ✅ Copy/paste from Excel (Ctrl+V)
17. ✅ Keyboard shortcuts:
    - Tab: Move to next cell
    - Shift+Tab: Move to previous cell
    - Enter: Move to next row, same column
    - Escape: Cancel edit
    - Delete: Clear cell

---

## 🎨 UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Estimation Items                                                 │
│ [🔙 Undo] [🔜 Redo] [➕ Add Item] [📋 Paste] [💾 Save]        │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search: [___________]           Total Items: 5               │
├─────────────────────────────────────────────────────────────────┤
│ Room | Category | Description | Unit | W | H | Qty | ... | Act │
├─────────────────────────────────────────────────────────────────┤
│ ▼ Living Room (5)                                               │
│   ▼ Woodwork (3)                                                │
│     ⠿ [Input] Woodwork TV Unit sqft 10 12 120 ₹500 ... 🗐 🗑  │
│     ⠿ [Input] Woodwork Wardrobe sqft 15 8 120 ₹600 ... 🗐 🗑  │
│   ▼ Misc (2)                                                    │
│     ⠿ [Input] Misc Painting no - - 5 ₹200 ... 🗐 🗑           │
└─────────────────────────────────────────────────────────────────┘
```

Legend:
- ⠿ = Drag handle
- 🗐 = Duplicate button
- 🗑 = Delete button

---

## 📦 State Management

```javascript
// Main data state
const [data, setData] = useState(items);

// History for undo/redo
const [history, setHistory] = useState([items]);
const [historyIndex, setHistoryIndex] = useState(0);

// Grouping state
const [grouping, setGrouping] = useState(['room_name', 'category']);
const [expanded, setExpanded] = useState({});

// Edit state
const [editingCell, setEditingCell] = useState(null);

// Clipboard
const [clipboard, setClipboard] = useState(null);
```

---

## 🔧 Core Functions

### 1. Update Cell
```javascript
const updateData = (rowIndex, columnId, value) => {
  setData(old => {
    const newData = old.map((row, index) => {
      if (index === rowIndex) {
        const updated = { ...row, [columnId]: value };
        
        // Auto-calculate quantity for sqft
        if (columnId === 'width' || columnId === 'height' || columnId === 'unit') {
          if (updated.unit === 'sqft' && updated.width && updated.height) {
            updated.quantity = parseFloat(updated.width) * parseFloat(updated.height);
          }
        }
        
        // Auto-apply default charges on category change
        if (columnId === 'category') {
          updated.karighar_charges_percentage = getDefaultCharges(value);
          updated.gst_percentage = bizModel.gst_percentage;
        }
        
        return updated;
      }
      return row;
    });
    
    // Add to history
    addToHistory(newData);
    return newData;
  });
};
```

### 2. Add/Delete/Duplicate Rows
```javascript
const addRow = () => {
  const newRow = {
    id: Date.now(),
    room_name: '',
    category: '',
    description: '',
    unit: 'sqft',
    // ... default values
  };
  const newData = [...data, newRow];
  setData(newData);
  addToHistory(newData);
};

const deleteRow = (rowIndex) => {
  const newData = data.filter((_, i) => i !== rowIndex);
  setData(newData);
  addToHistory(newData);
};

const duplicateRow = (rowIndex) => {
  const rowToDuplicate = { ...data[rowIndex], id: Date.now() };
  const newData = [
    ...data.slice(0, rowIndex + 1),
    rowToDuplicate,
    ...data.slice(rowIndex + 1)
  ];
  setData(newData);
  addToHistory(newData);
};
```

### 3. Undo/Redo
```javascript
const undo = () => {
  if (historyIndex > 0) {
    setHistoryIndex(historyIndex - 1);
    setData(history[historyIndex - 1]);
  }
};

const redo = () => {
  if (historyIndex < history.length - 1) {
    setHistoryIndex(historyIndex + 1);
    setData(history[historyIndex + 1]);
  }
};

const addToHistory = (newData) => {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(newData);
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};
```

### 4. Copy/Paste from Excel
```javascript
const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const rows = text.split('\n').filter(row => row.trim());
    
    const newRows = rows.map(row => {
      const cols = row.split('\t');
      return {
        id: Date.now() + Math.random(),
        room_name: cols[0] || '',
        category: cols[1] || '',
        description: cols[2] || '',
        unit: cols[3] || 'sqft',
        width: cols[4] || '',
        height: cols[5] || '',
        quantity: cols[6] || 1,
        unit_price: cols[7] || 0,
        // ... map all columns
      };
    });
    
    const newData = [...data, ...newRows];
    setData(newData);
    addToHistory(newData);
    toast.success(`Pasted ${newRows.length} rows from clipboard`);
  } catch (err) {
    toast.error('Failed to paste from clipboard');
  }
};
```

### 5. Keyboard Navigation
```javascript
const handleKeyDown = (e, rowIndex, columnId) => {
  switch (e.key) {
    case 'Tab':
      e.preventDefault();
      // Move to next/previous cell
      break;
    case 'Enter':
      e.preventDefault();
      // Move to next row, same column
      break;
    case 'Escape':
      // Cancel edit
      break;
    case 'Delete':
      // Clear cell
      break;
  }
};
```

### 6. Drag and Drop
```javascript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const handleDragEnd = (event) => {
  const { active, over } = event;
  if (active.id !== over.id) {
    setData((items) => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      const newData = arrayMove(items, oldIndex, newIndex);
      addToHistory(newData);
      return newData;
    });
  }
};
```

---

## 🎨 Column Definitions

```javascript
const columns = useMemo(() => [
  {
    id: 'drag',
    header: '',
    size: 50,
    cell: ({ row }) => (
      <DragHandle row={row} />
    ),
  },
  {
    accessorKey: 'room_name',
    header: 'Room/Section',
    enableGrouping: true,
    cell: EditableTextCell,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    enableGrouping: true,
    cell: EditableSelectCell,
    meta: {
      options: Object.values(ESTIMATION_CATEGORY),
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: EditableTextCell,
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
    cell: EditableSelectCell,
    meta: {
      options: ['sqft', 'no', 'lumpsum'],
    },
  },
  {
    accessorKey: 'width',
    header: 'Width',
    cell: ConditionalNumberCell, // Only show for sqft
  },
  {
    accessorKey: 'height',
    header: 'Height',
    cell: ConditionalNumberCell, // Only show for sqft
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
    cell: ({ row }) => {
      if (row.original.unit === 'sqft') {
        return <ReadOnlyCell value={row.original.quantity} />;
      }
      return <EditableNumberCell row={row} columnId="quantity" />;
    },
  },
  // ... more columns
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => duplicateRow(row.index)}>
          🗐
        </Button>
        <Button size="sm" onClick={() => deleteRow(row.index)}>
          🗑
        </Button>
      </div>
    ),
  },
], []);
```

---

## 🧩 Component Structure

```
ProjectEstimationPage
├── Header (Undo/Redo/Add/Paste/Save buttons)
├── Search & Filters
├── DndContext
│   └── TanStack Table
│       ├── Header Row
│       └── Body Rows (Sortable)
│           ├── Group Rows (Room/Category)
│           └── Data Rows (Editable Cells)
├── Totals Summary
└── Modals (Overpayment, Confirmation)
```

---

## 🎯 Implementation Steps

### Phase 1: Core Table (3-4 hours)
- [x] Install @dnd-kit packages
- [ ] Set up TanStack Table with data
- [ ] Create editable cell components
- [ ] Implement updateData function
- [ ] Add grouping support

### Phase 2: Add/Delete/Duplicate (1 hour)
- [ ] Add row button
- [ ] Delete row button with confirmation
- [ ] Duplicate row button

### Phase 3: Calculations (1 hour)
- [ ] Auto-calculate quantity (width × height)
- [ ] Real-time item total calculation
- [ ] Update totals on any change

### Phase 4: Drag & Drop (2 hours)
- [ ] Integrate @dnd-kit
- [ ] Add drag handles
- [ ] Implement reordering
- [ ] Update history on reorder

### Phase 5: Undo/Redo (1-2 hours)
- [ ] Implement history state
- [ ] Undo function
- [ ] Redo function
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- [ ] Show undo/redo status

### Phase 6: Copy/Paste (2 hours)
- [ ] Clipboard API integration
- [ ] Parse Excel/CSV format
- [ ] Map columns correctly
- [ ] Validation on paste

### Phase 7: Keyboard Navigation (2 hours)
- [ ] Tab navigation
- [ ] Enter navigation
- [ ] Escape to cancel
- [ ] Delete to clear
- [ ] Focus management

### Phase 8: Validation & Save (1-2 hours)
- [ ] Client-side validation
- [ ] Required field checks
- [ ] Conditional validation (width/height for sqft)
- [ ] Max discount validation
- [ ] Save with error handling

### Phase 9: Polish & Testing (2 hours)
- [ ] Loading states
- [ ] Error messages
- [ ] Success feedback
- [ ] Edge case handling
- [ ] Performance optimization

---

## 🚦 Current Status

**Started:** [Timestamp will be added]
**Estimated Completion:** 14-16 hours
**Current Phase:** Phase 1 - Core Table Setup

---

## 📊 Progress Tracking

- [ ] Phase 1: Core Table
- [ ] Phase 2: Add/Delete/Duplicate
- [ ] Phase 3: Calculations
- [ ] Phase 4: Drag & Drop
- [ ] Phase 5: Undo/Redo
- [ ] Phase 6: Copy/Paste
- [ ] Phase 7: Keyboard Navigation
- [ ] Phase 8: Validation & Save
- [ ] Phase 9: Polish & Testing

---

## 🎉 Success Criteria

1. All items can be edited inline
2. Grouping by Room → Category works
3. Can add/delete/duplicate rows
4. Drag-and-drop reordering works
5. Undo/redo works (at least 20 steps)
6. Can paste from Excel
7. Keyboard navigation works
8. All calculations are correct
9. Validation prevents bad data
10. Save functionality works

---

## 📝 Notes

- This is a comprehensive implementation
- Desktop-only focus allows for complex UI
- All nice-to-have features included
- Will be around 1200-1500 lines of code
- Performance optimization using useMemo and useCallback
- Accessibility considerations for keyboard navigation
