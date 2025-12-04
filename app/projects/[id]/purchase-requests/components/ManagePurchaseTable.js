import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useState, useMemo } from 'react';

export const ManagePurchaseTable = memo(function ManagePurchaseTable({
  data,
  vendors
}) {
  const [expandedRows, setExpandedRows] = useState({});

  const toggleCategoryRow = (category, index) => {
    setExpandedRows(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [index]: !(prev[category]?.[index])
      }
    }));
  };

  const getVendorName = (vendorId) => {
    return vendors.find(v => v.id == vendorId)?.name || '-';
  };

  // Group items by category
  const itemsByCategory = useMemo(() => {
    return data.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});
  }, [data]);

  // Calculate category summaries
  const categorySummaries = useMemo(() => {
    return Object.entries(itemsByCategory).map(([category, items]) => {
      // Total estimation price
      const estimationTotal = items.reduce((sum, item) => 
        sum + (parseFloat(item.estimation_item_total) || 0), 0
      );
      
      // Total purchase cost
      const purchaseTotal = items.reduce((sum, item) => {
        if (!item.fulfillmentMode || item.fulfillmentMode === 'none') return sum;
        
        if (item.fulfillmentMode === 'full') {
          // Full mode: single item total
          return sum + (parseFloat(item.prItems?.[0]?.item_total) || 0);
        }
        
        if (item.fulfillmentMode === 'component') {
          // Component mode: sum all component totals
          const componentTotal = (item.prItems || []).reduce((compSum, comp) => 
            compSum + (parseFloat(comp.item_total) || 0), 0
          );
          return sum + componentTotal;
        }
        
        return sum;
      }, 0);
      
      const margin = estimationTotal - purchaseTotal;
      const marginPercent = estimationTotal > 0 ? (margin / estimationTotal) * 100 : 0;
      
      return {
        category,
        estimationTotal,
        purchaseTotal,
        margin,
        marginPercent,
        itemsCount: items.length,
        purchasedCount: items.filter(i => i.fulfillmentMode && i.fulfillmentMode !== 'none').length
      };
    });
  }, [itemsByCategory]);

  // Sort categories alphabetically
  const sortedCategories = useMemo(() => {
    return Object.keys(itemsByCategory).sort();
  }, [itemsByCategory]);

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
    <div className="space-y-6">
      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorySummaries.map(summary => (
          <CategorySummaryCard key={summary.category} summary={summary} />
        ))}
      </div>

      {/* Category-wise Tables */}
      {sortedCategories.map(category => {
        const items = itemsByCategory[category];
        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{category}</CardTitle>
                <Badge variant="outline">{items.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CategoryItemsTable
                items={items}
                category={category}
                vendors={vendors}
                expandedRows={expandedRows[category] || {}}
                toggleRow={(index) => toggleCategoryRow(category, index)}
                getVendorName={getVendorName}
                getItemMargin={getItemMargin}
              />
            </CardContent>
          </Card>
        );
      })}
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
