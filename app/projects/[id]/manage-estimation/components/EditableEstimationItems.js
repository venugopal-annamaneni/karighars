import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';

import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, Trash2 } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from 'sonner';
export const EditableEstimationItems = memo(function EditableEstimationItems({
  data,
  setData,
  baseRates,
  calculateItemTotal,
}) {
  const tableContainerRef = useRef(null);
  const cellRefs = useRef({});

  const [columnPinning, setColumnPinning] = useState({
    left: ["room_name", "category", "item_name"],
    right: ["item_total", "actions"],
  });

  /** 🧩 Memoized & stable update function */
  const updateItem = useCallback(
    (index, field, value) => {
      setData((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, [field]: value };

          // Auto compute sqft qty
          if (["width", "height", "unit"].includes(field)) {
            if (updated.unit === "sqft" && updated.width && updated.height) {
              updated.quantity =
                parseFloat(updated.width) * parseFloat(updated.height);
            }
          }
          // Auto populate charges on category change
          if (field === "category") {
            const cat = baseRates.category_rates?.categories?.find(
              (c) => c.id === value
            );
            updated.karighar_charges_percentage = cat?.kg_percentage || 0;
            if (!updated.gst_percentage)
              updated.gst_percentage = baseRates.gst_percentage || 0;
          }
          return updated;
        })
      );
    },
    [setData, baseRates]
  );

  /** 🧩 Stable duplicate + remove functions */
  const duplicateItem = useCallback(
    (index) => {
      setData((prev) => {
        const clone = { ...prev[index], id: Date.now() };
        toast.success("Item duplicated");
        return [
          ...prev.slice(0, index + 1),
          clone,
          ...prev.slice(index + 1),
        ];
      });
    },
    [setData]
  );

  const removeItem = useCallback(
    (index) => {
      setData((prev) => prev.filter((_, i) => i !== index));
    },
    [setData]
  );

  /** 🧠 Register + focus helpers */
  function registerCellRef(table, rowIndex, columnId, ref) {
    const key = `${rowIndex}-${columnId}`;
    table.options.meta.cellRefs[key] = ref;
  }

  function focusCell(table, rowIndex, columnId, retries = 5) {
    const key = `${rowIndex}-${columnId}`;
    const ref = table.options.meta.cellRefs[key];
    if (ref?.current) {
      ref.current.focus();
      ref.current.select?.();
      ref.current.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    } else if (retries > 0) {
      queueMicrotask(() => focusCell(table, rowIndex, columnId, retries - 1));
    }
  }

  /** 🧠 Editable TextCell */
  const EditableTextCell = memo(function EditableTextCell({
    getValue,
    row,
    column,
    table,
    type = "text",
    readOnly = false,
  }) {
    const inputRef = useRef(null);
    registerCellRef(table, row.index, column.id, inputRef);
    const [value, setValue] = useState(getValue() ?? "");
    useEffect(() => setValue(getValue() ?? ""), [getValue]);

    const onBlur = () => table.options.meta.updateData(row.index, column.id, value);

    const onKeyDown = (e) => {
      const visibleCols = table.getVisibleLeafColumns();
      const idx = visibleCols.findIndex((c) => c.id === column.id);

      if (e.key === "Enter") {
        e.preventDefault();
        onBlur();
        setTimeout(() => focusCell(table, row.index + 1, column.id), 0);
      } else if (e.key === "Tab") {
        e.preventDefault();
        onBlur();
        const next = visibleCols[idx + (e.shiftKey ? -1 : 1)];
        if (next) focusCell(table, row.index, next.id);
        else focusCell(table, row.index + 1, visibleCols[0].id);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        focusCell(table, row.index + 1, column.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusCell(table, row.index - 1, column.id);
      } else if (e.key === "Escape") {
        setValue(getValue() ?? "");
        inputRef.current?.blur();
      }
    };

    return (
      <Input
        ref={inputRef}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`h-8 text-sm ${readOnly
          ? "bg-gray-100 text-gray-400 border-gray-200"
          : "border-gray-300"
          } ${type === 'number' ? "text-right" : "text-left"}`}
      />
    );
  });

  const EditableNumberCell = (props) => (
    <EditableTextCell {...props} type="number" />
  );

  const EditableSelectCell = memo(function EditableSelectCell({
    getValue,
    row,
    column,
    table,
    options,
  }) {
    const selectRef = useRef(null);
    registerCellRef(table, row.index, column.id, selectRef);
    return (
      <Select
        value={getValue()}
        onValueChange={(value) =>
          table.options.meta.updateData(row.index, column.id, value)
        }
      >
        <SelectTrigger ref={selectRef} className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  });

  /** ⚙️ Columns — memoized */
  const columns = useMemo(() => {
    const catOptions =
      baseRates.category_rates?.categories?.map((cat) => ({
        value: cat.id,
        label: cat.category_name,
      })) || [];

    return [
      { accessorKey: "room_name", header: "Room/Section", size: 150, cell: EditableTextCell },
      {
        accessorKey: "category",
        header: "Category",
        size: 130,
        cell: (ctx) => (
          <EditableSelectCell
            {...ctx}
            options={catOptions.sort(
              (a, b) =>
                (baseRates.category_rates?.categories.find((c) => c.id === a.value)?.sort_order ||
                  0) -
                (baseRates.category_rates?.categories.find((c) => c.id === b.value)?.sort_order ||
                  0)
            )}
          />
        ),
      },
      { accessorKey: "item_name", header: "Item Name", size: 180, cell: EditableTextCell },
      {
        accessorKey: "unit",
        header: "Unit",
        size: 100,
        cell: (ctx) => (
          <EditableSelectCell
            {...ctx}
            options={[
              { value: "sqft", label: "Sq.ft" },
              { value: "no", label: "No" },
              { value: "lumpsum", label: "Lumpsum" },
            ]}
          />
        ),
      },
      { accessorKey: "width", header: "Width", size: 90, cell: (ctx) => <EditableNumberCell {...ctx} readOnly={ctx.row.original.unit !== "sqft"} /> },
      { accessorKey: "height", header: "Height", size: 90, cell: (ctx) => <EditableNumberCell {...ctx} readOnly={ctx.row.original.unit !== "sqft"} /> },
      { accessorKey: "quantity", header: "Qty", size: 100, cell: (ctx) => <EditableNumberCell {...ctx} readOnly={ctx.row.original.unit === "sqft"} /> },
      { accessorKey: "unit_price", header: "Unit Price (₹)", size: 120, cell: EditableNumberCell },
      {
        accessorKey: "item_discount_percentage", header: "Item Disc (%)", size: 110, cell: (ctx) => {
          const thisCategory = baseRates.category_rates.categories.find((cat) => cat.id === ctx.row.original.category)
          return <EditableNumberCell {...ctx} readOnly={thisCategory.pay_to_vendor_directly} />
        }
      },
      { accessorKey: "karighar_charges_percentage", header: "KG Charges (%)", size: 120, cell: EditableNumberCell },
      { accessorKey: "discount_kg_charges_percentage", header: "KG Disc (%)", size: 110, cell: EditableNumberCell },
      { accessorKey: "gst_percentage", header: "GST (%)", size: 90, cell: EditableNumberCell },
      {
        accessorKey: "vendor_type",
        header: "Vendor",
        size: 100,
        cell: (ctx) => (
          <EditableSelectCell
            {...ctx}
            options={[
              { value: "PI", label: "PI" },
              { value: "Aristo", label: "Aristo" },
              { value: "Other", label: "Other" },
            ]}
          />
        ),
      },
      {
        id: "item_total",
        header: "Item Total",
        size: 120,
        cell: ({ row }) => {
          const total = useMemo(
            () => calculateItemTotal(row.original).item_total,
            [row.original, calculateItemTotal]
          );
          return (
            <div className="font-medium text-green-700 text-sm">
              {formatCurrency(total)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1 justify-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => duplicateItem(row.index)}
              title="Duplicate"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeItem(row.index)}
              className="text-red-600 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
    ];
  }, [baseRates, calculateItemTotal, duplicateItem, removeItem]);

  /** ⚡ Table Instance */
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { columnPinning },
    onColumnPinningChange: setColumnPinning,
    meta: { updateData: updateItem, cellRefs: cellRefs.current },
  });

  /** 🌀 Virtualized Rows (middle section) */
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  /** Scroll sync left/middle/right */
  useEffect(() => {
    const left = document.getElementById("left-fixed");
    const right = document.getElementById("right-fixed");
    const middle = document.getElementById("middle-scroll");
    if (!left || !right || !middle) return;
    const sync = () => {
      left.scrollTop = middle.scrollTop;
      right.scrollTop = middle.scrollTop;
    };
    middle.addEventListener("scroll", sync);
    return () => middle.removeEventListener("scroll", sync);
  }, []);

  /** 🧩 Render */
  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-3 mb-2">
        <div className="text-sm text-muted-foreground">
          Total Items: {data.length}
        </div>
        {/* {showAddButton && (
          <Button type="button" onClick={addItem} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        )} */}
      </div>

      <div className="flex w-full border rounded-lg" style={{ maxHeight: "600px" }}>
        {/* LEFT FIXED */}
        <div id="left-fixed" className="flex-none w-[465px] border-r overflow-hidden" style={{ overflowY: "auto" }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-100 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers
                    .filter((h) => ["room_name", "category", "item_name"].includes(h.column.id))
                    .map((header) => (
                      <th key={header.id} className="p-2 border-b font-semibold" width="155px">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <tr
                    key={row.id}
                    className="bg-white border-b"
                    style={{ position: "absolute", top: 0, transform: `translateY(${vr.start}px)` }}
                  >
                    {row
                      .getVisibleCells()
                      .filter((c) => ["room_name", "category", "item_name"].includes(c.column.id))
                      .map((cell) => (
                        <td key={cell.id} className="p-2 border-r" width="155px">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* MIDDLE SCROLL */}
        <div ref={tableContainerRef} id="middle-scroll" className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="sticky top-0 bg-slate-100 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers
                    .filter(
                      (h) =>
                        !["room_name", "category", "item_name", "item_total", "actions"].includes(h.column.id)
                    )
                    .map((header) => (
                      <th key={header.id} className="p-2 border-b font-semibold whitespace-nowrap w-[120px]">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <tr
                    key={row.id}
                    style={{ position: "absolute", top: 0, transform: `translateY(${vr.start}px)` }}
                    className="border-b bg-white"
                  >
                    {row
                      .getVisibleCells()
                      .filter(
                        (c) =>
                          !["room_name", "category", "item_name", "item_total", "actions"].includes(c.column.id)
                      )
                      .map((cell) => (
                        <td key={cell.id} className="p-2 border-r w-[120px]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT FIXED */}
        <div id="right-fixed" className="flex-none w-[210px] border-l overflow-hidden" style={{ overflowY: "auto" }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-100 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers
                    .filter((h) => ["item_total", "actions"].includes(h.column.id))
                    .map((header) => (
                      <th key={header.id} className="p-2 border-b font-semibold" width="105px" >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <tr
                    key={row.id}
                    className="border-b bg-white"
                    style={{ position: "absolute", top: 0, transform: `translateY(${vr.start}px)` }}
                  >
                    {row
                      .getVisibleCells()
                      .filter((c) => ["item_total", "actions"].includes(c.column.id))
                      .map((cell) => (
                        <td key={cell.id} className="p-2 border-r text-right" width="105px">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
