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

// Category Summary Card Component
function CategorySummaryCard({ summary }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{summary.category}</CardTitle>
        <CardDescription>
          {summary.purchasedCount}/{summary.itemsCount} items purchased
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimation:</span>
          <span className="font-medium">{formatCurrency(summary.estimationTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Purchase:</span>
          <span className="font-medium">{formatCurrency(summary.purchaseTotal)}</span>
        </div>
        <Separator />
        <div className="flex justify-between items-start pt-1">
          <span className="font-semibold">Margin:</span>
          <div className="text-right">
            <div className={`font-semibold ${summary.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.margin >= 0 ? '+' : '-'}{formatCurrency(Math.abs(summary.margin))}
            </div>
            <div className={`text-xs ${summary.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.marginPercent >= 0 ? '↑' : '↓'} {Math.abs(summary.marginPercent).toFixed(1)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Category Items Table Component (without Category column)
function CategoryItemsTable({ items, category, vendors, expandedRows, toggleRow, getVendorName, getItemMargin }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3 text-sm font-medium w-[40px]"></th>
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
          {items.map((item, index) => (
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
                  <td colSpan="12" className="bg-accent/20 p-0">
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
}

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
