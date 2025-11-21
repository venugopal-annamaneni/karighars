import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

export const AdditionalPurchasesTable = memo(function AdditionalPurchasesTable({
  data,
  setData,
  vendors
}) {
  const updateItem = useCallback((index, field, value) => {
    setData(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto-calculate sqft quantity
      if (['width', 'height'].includes(field) && updated.unit === 'sqft') {
        if (updated.width && updated.height) {
          updated.quantity = parseFloat(updated.width) * parseFloat(updated.height);
        }
      }
      
      return updated;
    }));
  }, [setData]);

  const removeItem = useCallback((index) => {
    setData(prev => prev.filter((_, i) => i !== index));
  }, [setData]);

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Item Name',
      cell: ({ row }) => (
        <Input
          value={row.original.name}
          onChange={(e) => updateItem(row.index, 'name', e.target.value)}
          placeholder="Item name"
          className="w-full"
        />
      ),
      size: 200
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      cell: ({ row }) => (
        <Select
          value={row.original.unit}
          onValueChange={(value) => updateItem(row.index, 'unit', value)}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sqft">sqft</SelectItem>
            <SelectItem value="pcs">pcs</SelectItem>
            <SelectItem value="sheet">sheet</SelectItem>
            <SelectItem value="lumpsum">lumpsum</SelectItem>
            <SelectItem value="bag">bag</SelectItem>
            <SelectItem value="box">box</SelectItem>
          </SelectContent>
        </Select>
      ),
      size: 120
    },
    {
      accessorKey: 'width',
      header: 'Width',
      cell: ({ row }) => {
        if (row.original.unit !== 'sqft') return '-';
        return (
          <Input
            type="number"
            value={row.original.width || ''}
            onChange={(e) => updateItem(row.index, 'width', parseFloat(e.target.value) || null)}
            placeholder="0"
            className="w-[80px]"
          />
        );
      },
      size: 100
    },
    {
      accessorKey: 'height',
      header: 'Height',
      cell: ({ row }) => {
        if (row.original.unit !== 'sqft') return '-';
        return (
          <Input
            type="number"
            value={row.original.height || ''}
            onChange={(e) => updateItem(row.index, 'height', parseFloat(e.target.value) || null)}
            placeholder="0"
            className="w-[80px]"
          />
        );
      },
      size: 100
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      cell: ({ row }) => (
        <Input
          type="number"
          value={row.original.quantity}
          onChange={(e) => updateItem(row.index, 'quantity', parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-[100px]"
          disabled={row.original.unit === 'sqft' && row.original.width && row.original.height}
        />
      ),
      size: 120
    },
    {
      accessorKey: 'vendor_id',
      header: 'Vendor',
      cell: ({ row }) => (
        <Select
          value={row.original.vendor_id?.toString()}
          onValueChange={(value) => updateItem(row.index, 'vendor_id', parseInt(value))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Select vendor" />
          </SelectTrigger>
          <SelectContent>
            {vendors.map(vendor => (
              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                {vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
      size: 180
    },
    {
      accessorKey: 'unit_price',
      header: 'Unit Price',
      cell: ({ row }) => (
        <Input
          type="number"
          value={row.original.unit_price}
          onChange={(e) => updateItem(row.index, 'unit_price', parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-[120px]"
        />
      ),
      size: 140
    },
    {
      accessorKey: 'gst_percentage',
      header: 'GST%',
      cell: ({ row }) => (
        <Input
          type="number"
          value={row.original.gst_percentage}
          onChange={(e) => updateItem(row.index, 'gst_percentage', parseFloat(e.target.value) || 18)}
          placeholder="18"
          className="w-[80px]"
        />
      ),
      size: 100
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => removeItem(row.index)}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
      size: 80
    }
  ], [vendors, updateItem, removeItem]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No additional purchases. Click "Add Item" to add direct purchase items.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="text-left p-3 text-sm font-medium"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="border-t hover:bg-accent/50">
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="p-3 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
