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
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3 text-sm font-medium w-[40px]"></th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Category</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Room</th>
            <th className="text-left p-3 text-sm font-medium w-[180px]">Item Name</th>
            <th className="text-left p-3 text-sm font-medium w-[80px]">Unit</th>
            <th className="text-left p-3 text-sm font-medium w-[60px]">W</th>
            <th className="text-left p-3 text-sm font-medium w-[60px]">H</th>
            <th className="text-left p-3 text-sm font-medium w-[80px]">Qty</th>
            <th className="text-left p-3 text-sm font-medium w-[100px]">Est. Price</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Mode</th>
            <th className="text-left p-3 text-sm font-medium w-[200px]">Vendor</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Unit Price</th>
            <th className="text-left p-3 text-sm font-medium w-[80px]">GST%</th>
            <th className="text-left p-3 text-sm font-medium w-[100px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <>
              {/* Parent Row */}
              <tr key={index} className="border-t hover:bg-accent/50">
                <td className="p-3 text-sm">
                  {item.fulfillmentMode === 'component' && (
                    <button
                      onClick={() => toggleRow(index)}
                      className="p-1 hover:bg-accent rounded"
                    >
                      {expandedRows[index] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </td>
                <td className="p-3 text-sm font-medium">{item.category}</td>
                <td className="p-3 text-sm">{item.room_name}</td>
                <td className="p-3 text-sm font-medium">{item.item_name}</td>
                <td className="p-3 text-sm">{item.unit}</td>
                <td className="p-3 text-sm">{item.width || '-'}</td>
                <td className="p-3 text-sm">{item.height || '-'}</td>
                <td className="p-3 text-sm">{parseFloat(item.quantity || 0).toFixed(2)}</td>
                <td className="p-3 text-sm">{formatCurrency(item.estimation_item_total)}</td>
                <td className="p-3 text-sm">
                  {item.fulfillmentMode ? (
                    <Badge variant={item.fulfillmentMode === 'full' ? 'default' : 'secondary'}>
                      {item.fulfillmentMode === 'full' ? 'Full Item' : 
                       item.fulfillmentMode === 'component' ? 'Components' : 'None'}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {item.fulfillmentMode === 'component' ? (
                    <div className="flex flex-wrap gap-1">
                      {(item.prItems || []).map((prItem, idx) => (
                        <Badge key={idx} variant="outline">
                          {getVendorName(prItem.vendor_id)}
                        </Badge>
                      ))}
                    </div>
                  ) : item.fulfillmentMode === 'full' ? (
                    getVendorName(item.prItems?.[0]?.vendor_id)
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {item.fulfillmentMode === 'component' ? (
                    formatCurrency(
                      (item.prItems || []).reduce((sum, c) => sum + (parseFloat(c.unit_price) || 0), 0)
                    )
                  ) : item.fulfillmentMode === 'full' ? (
                    formatCurrency(item.prItems?.[0]?.unit_price || 0)
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {item.fulfillmentMode === 'full' ? (
                    `${item.prItems?.[0]?.gst_percentage || 18}%`
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {item.fulfillmentMode === 'component' ? (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set((item.prItems || []).map(c => c.status || 'Draft'))].map((status, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {status}
                        </Badge>
                      ))}
                    </div>
                  ) : item.fulfillmentMode === 'full' ? (
                    <Badge variant="outline" className="text-xs">
                      {item.prItems?.[0]?.status || 'Draft'}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>

              {/* Component Child Table */}
              {expandedRows[index] && item.fulfillmentMode === 'component' && item.prItems && (
                <tr>
                  <td colSpan="14" className="bg-accent/20 p-0">
                    <div className="p-4 ml-10">
                      <h4 className="font-semibold text-xs mb-3">Components</h4>
                      <ComponentsSubTable
                        prItems={item.prItems}
                        vendors={vendors}
                        getVendorName={getVendorName}
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
