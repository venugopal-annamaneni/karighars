import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useState } from 'react';

export const ManagePurchaseTable = memo(function ManagePurchaseTable({
  data,
  vendors
}) {
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (index) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getVendorName = (vendorId) => {
    return vendors.find(v => v.id == vendorId)?.name || '-';
  };

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
              <React.Fragment key={row.id}>
                <tr className="border-t hover:bg-accent/50">
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
                      <div className="p-4 ml-10">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-xs">Components</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addComponent(row.index)}
                            className="gap-2 text-xs"
                          >
                            <Plus className="h-3 w-3" />
                            Add Component
                          </Button>
                        </div>

                        <ComponentsSubTable
                          prItems={row.original.prItems || []}
                          itemIndex={row.index}
                          updateComponent={updateComponent}
                          removeComponent={removeComponent}
                          vendors={vendors}
                        />
                      </div>
                    </td>
                  </tr>
                )}

              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// Component Sub-table
function ComponentsSubTable({ prItems, itemIndex, updateComponent, removeComponent, vendors }) {
  const totalWeightage = prItems.reduce((sum, c) => sum + (parseFloat(c.weightage) || 0), 0);
  const isValid = Math.abs(totalWeightage - 1.0) < 0.001;

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
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
          {prItems.map((comp, compIndex) => (
            <tr key={compIndex} className="border-t">
              <td className="p-2">
                <Input
                  value={comp.item_name}
                  onChange={(e) => updateComponent(itemIndex, compIndex, 'item_name', e.target.value)}
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
