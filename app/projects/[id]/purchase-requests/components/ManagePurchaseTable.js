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

  const getItemMargin = (item) => {
    let itemPrice = 0;
    let itemCost = 0;

    if (item.fulfillmentMode === "component") {
      itemPrice = Number(item.estimation_item_total) || 0;
      itemCost = (item.prItems || [])
        .reduce((sum, c) => sum + (Number(c.item_total) || 0), 0);
    }
    else if (item.fulfillmentMode === "full") {
      itemPrice = Number(item.estimation_item_total) || 0;
      itemCost = Number(item.prItems?.[0]?.item_total) || 0;
    }
    else {
      return "-";
    }

    if (!itemPrice) return "-"; // avoid divide by zero

    const margin = Math.round(((itemPrice - itemCost) / itemPrice) * 100);
    if (margin > 0) {
      return <span className='text-green-600 font-bold'>{margin} %</span>
    } else {
      return <span className='text-red-600 font-bold'>{margin} %</span>
    }
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
            <th className="text-left p-3 text-sm font-medium w-[120px]">Cost</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Margin %</th>
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
                    <Badge variant="outline">{getVendorName(item.prItems?.[0]?.vendor_id)}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {item.fulfillmentMode === 'component' ? (
                    formatCurrency(
                      (item.prItems || []).reduce((sum, c) => sum + (parseFloat(c.item_total) || 0), 0)
                    )
                  ) : item.fulfillmentMode === 'full' ? (
                    formatCurrency(item.prItems?.[0]?.item_total || 0)
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {getItemMargin(item)}
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

// Component Sub-table (Non-Editable)
function ComponentsSubTable({ prItems, vendors, getVendorName }) {
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
            <th className="text-left p-2">Subtotal</th>
            <th className="text-left p-2">Item Total</th>
          </tr>
        </thead>
        <tbody>
          {prItems.map((comp, compIndex) => (
            <tr key={compIndex} className="border-t hover:bg-accent/30">
              <td className="p-2">{comp.item_name || comp.purchase_request_item_name || '-'}</td>
              <td className="p-2">{comp.unit}</td>
              <td className="p-2">{comp.width || '-'}</td>
              <td className="p-2">{comp.height || '-'}</td>
              <td className="p-2">{parseFloat(comp.quantity || 0).toFixed(2)}</td>
              <td className="p-2">{((parseFloat(comp.weightage) || 0) * 100).toFixed(1)}%</td>
              <td className="p-2">
                <Badge variant="outline" className="text-xs">{getVendorName(comp.vendor_id)}</Badge>
              </td>
              <td className="p-2">{formatCurrency(comp.unit_price)}</td>
              <td className="p-2">{comp.gst_percentage}%</td>
              <td className="p-2">{formatCurrency(comp.subtotal)}</td>
              <td className="p-2 font-medium">{formatCurrency(comp.item_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/30">
          <tr>
            <td colSpan="5" className="p-2 text-right font-semibold text-xs">
              Total Weightage:
            </td>
            <td className="p-2">
              <span className={isValid ? 'text-green-600 font-semibold text-xs' : 'text-red-600 font-semibold text-xs'}>
                {(totalWeightage * 100).toFixed(1)}%
              </span>
            </td>
            <td colSpan="5"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
