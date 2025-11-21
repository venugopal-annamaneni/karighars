import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, getExpandedRowModel } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

export const ManagePurchaseTable = memo(function ManagePurchaseTable({
  data,
  setData,
  vendors
}) {
  const [expanded, setExpanded] = useState({});

  const updateItem = useCallback((index, field, value) => {
    setData(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const updated = { ...item, [field]: value };
      
      // Reset fields when mode changes
      if (field === 'fulfillmentMode') {
        if (value === 'full') {
          updated.components = [];
          updated.vendor_id = null;
          updated.unit_price = null;
          updated.gst_percentage = 18;
        } else if (value === 'component') {
          updated.vendor_id = null;
          updated.unit_price = null;
          updated.components = [];
        } else if (value === 'none' || !value) {
          updated.vendor_id = null;
          updated.unit_price = null;
          updated.components = [];
        }
      }
      
      // Auto-calculate sqft quantity
      if (['width', 'height'].includes(field) && updated.unit === 'sqft') {
        if (updated.width && updated.height) {
          updated.quantity = parseFloat(updated.width) * parseFloat(updated.height);
        }
      }
      
      return updated;
    }));
  }, [setData]);

  const addComponent = useCallback((index) => {
    setData(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const components = item.components || [];
      return {
        ...item,
        components: [
          ...components,
          {
            id: `comp-${Date.now()}`,
            name: '',
            unit: item.unit,
            width: null,
            height: null,
            quantity: 0,
            weightage: 0,
            vendor_id: null,
            unit_price: 0,
            gst_percentage: 18
          }
        ]
      };
    }));
  }, [setData]);

  const updateComponent = useCallback((itemIndex, compIndex, field, value) => {
    setData(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item;
      
      const components = [...(item.components || [])];
      components[compIndex] = {
        ...components[compIndex],
        [field]: value
      };
      
      // Auto-calculate sqft quantity for component
      if (['width', 'height'].includes(field) && components[compIndex].unit === 'sqft') {
        if (components[compIndex].width && components[compIndex].height) {
          components[compIndex].quantity = 
            parseFloat(components[compIndex].width) * parseFloat(components[compIndex].height);
        }
      }
      
      return { ...item, components };
    }));
  }, [setData]);

  const removeComponent = useCallback((itemIndex, compIndex) => {
    setData(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item;
      
      const components = item.components.filter((_, ci) => ci !== compIndex);
      return { ...item, components };
    }));
  }, [setData]);

  const columns = useMemo(() => [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
        if (row.original.fulfillmentMode !== 'component') return null;
        return (
          <button
            onClick={() => row.toggleExpanded()}
            className="p-1 hover:bg-accent rounded"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        );
      },
      size: 40
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.category}</div>
      ),
      size: 120
    },
    {
      accessorKey: 'room_name',
      header: 'Room',
      cell: ({ row }) => (
        <div>{row.original.room_name}</div>
      ),
      size: 120
    },
    {
      accessorKey: 'item_name',
      header: 'Item Name',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.item_name}</div>
      ),
      size: 180
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      size: 80
    },
    {
      accessorKey: 'width',
      header: 'W',
      cell: ({ row }) => row.original.width || '-',
      size: 60
    },
    {
      accessorKey: 'height',
      header: 'H',
      cell: ({ row }) => row.original.height || '-',
      size: 60
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => parseFloat(row.original.quantity || 0).toFixed(2),
      size: 80
    },
    {
      accessorKey: 'estimation_item_total',
      header: 'Est. Price',
      cell: ({ row }) => formatCurrency(row.original.estimation_item_total),
      size: 100
    },
    {
      id: 'fulfillmentMode',
      header: 'Mode',
      cell: ({ row }) => (
        <Select
          value={row.original.fulfillmentMode || 'none'}
          onValueChange={(value) => updateItem(row.index, 'fulfillmentMode', value)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="full">Full Item</SelectItem>
            <SelectItem value="component">Components</SelectItem>
          </SelectContent>
        </Select>
      ),
      size: 140
    },
    {
      id: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => {
        const mode = row.original.fulfillmentMode;
        
        if (mode === 'component') {
          // Show CSV of vendors
          const vendorNames = (row.original.components || [])
            .map(c => vendors.find(v => v.id == c.vendor_id)?.name)
            .filter(Boolean)
            .join(', ');
          return <div className="text-sm">{vendorNames || '-'}</div>;
        }
        
        if (mode === 'full') {
          return (
            <Select
              value={row.original.vendor_id?.toString()}
              onValueChange={(value) => updateItem(row.index, 'vendor_id', parseInt(value))}
            >
              <SelectTrigger className="w-[140px]">
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
          );
        }
        
        return '-';
      },
      size: 160
    },
    {
      id: 'unit_price',
      header: 'Unit Price',
      cell: ({ row }) => {
        const mode = row.original.fulfillmentMode;
        
        if (mode === 'component') {
          // Show sum of component prices
          const total = (row.original.components || [])
            .reduce((sum, c) => sum + (parseFloat(c.unit_price) || 0), 0);
          return formatCurrency(total);
        }
        
        if (mode === 'full') {
          return (
            <Input
              type="number"
              value={row.original.unit_price || ''}
              onChange={(e) => updateItem(row.index, 'unit_price', parseFloat(e.target.value) || 0)}
              className="w-[100px]"
              placeholder="0"
            />
          );
        }
        
        return '-';
      },
      size: 120
    },
    {
      id: 'gst',
      header: 'GST%',
      cell: ({ row }) => {
        const mode = row.original.fulfillmentMode;
        
        if (mode === 'full') {
          return (
            <Input
              type="number"
              value={row.original.gst_percentage || 18}
              onChange={(e) => updateItem(row.index, 'gst_percentage', parseFloat(e.target.value) || 18)}
              className="w-[70px]"
            />
          );
        }
        
        return '-';
      },
      size: 80
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const mode = row.original.fulfillmentMode;
        
        if (mode === 'component') {
          // Show CSV of statuses
          const statuses = (row.original.components || [])
            .map(c => c.status)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(', ');
          return <div className="text-sm">{statuses || 'Draft'}</div>;
        }
        
        if (mode === 'full') {
          return <div className="text-sm">{row.original.prItems?.[0]?.status || 'Draft'}</div>;
        }
        
        return '-';
      },
      size: 100
    }
  ], [vendors, updateItem]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      expanded
    },
    onExpandedChange: setExpanded,
    getRowCanExpand: (row) => row.original.fulfillmentMode === 'component'
  });

  return (
    <div className="border rounded-lg">
      <div className="overflow-x-auto">
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
              <>
                <tr key={row.id} className="border-t hover:bg-accent/50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                
                {/* Component Child Table */}
                {row.getIsExpanded() && row.original.fulfillmentMode === 'component' && (
                  <tr>
                    <td colSpan={columns.length} className="bg-accent/20 p-0">
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-sm">Components</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addComponent(row.index)}
                            className="gap-2"
                          >
                            <Plus className="h-3 w-3" />
                            Add Component
                          </Button>
                        </div>
                        
                        <ComponentsSubTable
                          components={row.original.components || []}
                          itemIndex={row.index}
                          updateComponent={updateComponent}
                          removeComponent={removeComponent}
                          vendors={vendors}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// Component Sub-table
function ComponentsSubTable({ components, itemIndex, updateComponent, removeComponent, vendors }) {
  debugger;
  const totalWeightage = components.reduce((sum, c) => sum + (parseFloat(c.weightage) || 0), 0);
  const isValid = Math.abs(totalWeightage - 1.0) < 0.001;

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">Component Name</th>
            <th className="text-left p-2">Unit</th>
            <th className="text-left p-2">W</th>
            <th className="text-left p-2">H</th>
            <th className="text-left p-2">Qty</th>
            <th className="text-left p-2">Weightage</th>
            <th className="text-left p-2">Vendor</th>
            <th className="text-left p-2">Unit Price</th>
            <th className="text-left p-2">GST%</th>
            <th className="text-right p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {components.map((comp, compIndex) => (
            <tr key={comp.id} className="border-t">
              <td className="p-2">
                <Input
                  value={comp.name}
                  onChange={(e) => updateComponent(itemIndex, compIndex, 'name', e.target.value)}
                  placeholder="Component name"
                  className="w-full"
                />
              </td>
              <td className="p-2">
                <Select
                  value={comp.unit}
                  onValueChange={(value) => updateComponent(itemIndex, compIndex, 'unit', value)}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sqft">sqft</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="sheet">sheet</SelectItem>
                    <SelectItem value="lumpsum">lumpsum</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="p-2">
                {comp.unit === 'sqft' ? (
                  <Input
                    type="number"
                    value={comp.width || ''}
                    onChange={(e) => updateComponent(itemIndex, compIndex, 'width', parseFloat(e.target.value) || null)}
                    className="w-[60px]"
                  />
                ) : '-'}
              </td>
              <td className="p-2">
                {comp.unit === 'sqft' ? (
                  <Input
                    type="number"
                    value={comp.height || ''}
                    onChange={(e) => updateComponent(itemIndex, compIndex, 'height', parseFloat(e.target.value) || null)}
                    className="w-[60px]"
                  />
                ) : '-'}
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  value={comp.quantity}
                  onChange={(e) => updateComponent(itemIndex, compIndex, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-[80px]"
                  disabled={comp.unit === 'sqft' && comp.width && comp.height}
                />
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={comp.weightage}
                  onChange={(e) => updateComponent(itemIndex, compIndex, 'weightage', parseFloat(e.target.value) || 0)}
                  className="w-[80px]"
                  placeholder="0.5"
                />
              </td>
              <td className="p-2">
                <Select
                  value={comp.vendor_id?.toString()}
                  onValueChange={(value) => updateComponent(itemIndex, compIndex, 'vendor_id', parseInt(value))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id.toString()}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  value={comp.unit_price}
                  onChange={(e) => updateComponent(itemIndex, compIndex, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="w-[100px]"
                />
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  value={comp.gst_percentage}
                  onChange={(e) => updateComponent(itemIndex, compIndex, 'gst_percentage', parseFloat(e.target.value) || 18)}
                  className="w-[70px]"
                />
              </td>
              <td className="p-2 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeComponent(itemIndex, compIndex)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/30">
          <tr>
            <td colSpan="5" className="p-2 text-right font-semibold">
              Total Weightage:
            </td>
            <td className="p-2">
              <span className={isValid ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {(totalWeightage * 100).toFixed(1)}%
              </span>
            </td>
            <td colSpan="4"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
