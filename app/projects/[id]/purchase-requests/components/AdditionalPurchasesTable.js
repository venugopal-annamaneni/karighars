import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { memo } from 'react';

export const AdditionalPurchasesTable = memo(function AdditionalPurchasesTable({
  data,
  vendors
}) {
  const getVendorName = (vendorId) => {
    return vendors.find(v => v.id == vendorId)?.name || '-';
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No additional purchases found.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3 text-sm font-medium w-[200px]">Item Name</th>
            <th className="text-left p-3 text-sm font-medium w-[100px]">Unit</th>
            <th className="text-left p-3 text-sm font-medium w-[80px]">Width</th>
            <th className="text-left p-3 text-sm font-medium w-[80px]">Height</th>
            <th className="text-left p-3 text-sm font-medium w-[100px]">Quantity</th>
            <th className="text-left p-3 text-sm font-medium w-[160px]">Vendor</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Unit Price</th>
            <th className="text-left p-3 text-sm font-medium w-[80px]">GST%</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Subtotal</th>
            <th className="text-left p-3 text-sm font-medium w-[120px]">Item Total</th>
            <th className="text-left p-3 text-sm font-medium w-[100px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-t hover:bg-accent/50">
              <td className="p-3 text-sm font-medium">{item.name || item.purchase_request_item_name}</td>
              <td className="p-3 text-sm">{item.unit}</td>
              <td className="p-3 text-sm">{item.width || '-'}</td>
              <td className="p-3 text-sm">{item.height || '-'}</td>
              <td className="p-3 text-sm">{parseFloat(item.quantity || 0).toFixed(2)}</td>
              <td className="p-3 text-sm">
                <Badge variant="outline">{getVendorName(item.vendor_id)}</Badge>
              </td>
              <td className="p-3 text-sm">{formatCurrency(item.unit_price)}</td>
              <td className="p-3 text-sm">{item.gst_percentage || 18}%</td>
              <td className="p-3 text-sm">{formatCurrency(item.subtotal || 0)}</td>
              <td className="p-3 text-sm font-medium">{formatCurrency(item.item_total || 0)}</td>
              <td className="p-3 text-sm">
                <Badge variant="outline" className="text-xs">
                  {item.status || 'Draft'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
