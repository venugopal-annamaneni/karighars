"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";


export default function EstimationItemsTable({
  groupedItems,
  selectedIds = [],
  selectedId = null,
  mode,
  onSelect,
  loading = false
}) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([category, items]) => {
        const availableItems = items.filter((i) => i.available_qty > 0);
        if (availableItems.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="font-semibold capitalize mb-3">{category}</h3>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="w-12 p-3"></th>
                    <th className="text-left p-3 font-medium">Room</th>
                    <th className="text-left p-3 font-medium">Item Name</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-left p-3 font-medium">Width</th>
                    <th className="text-left p-3 font-medium">Height</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Confirmed</th>
                    <th className="text-right p-3 font-medium">Draft</th>
                    <th className="text-right p-3 font-medium">Pending</th>
                  </tr>
                </thead>

                <tbody>
                  {availableItems.map((item) => {
                    const checked =
                      mode === "checkbox"
                        ? selectedIds.includes(item.id)
                        : selectedId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-t cursor-pointer hover:bg-accent/50 transition-colors",
                          checked && "bg-accent/30"
                        )}
                        onClick={() => onSelect(item)}
                      >
                        <td className="p-3 text-center">
                          {mode === "checkbox" ? (
                            <Checkbox checked={checked} />
                          ) : (
                            <input
                              type="radio"
                              checked={checked}
                              onChange={() => onSelect(item)}
                              className="w-4 h-4"
                            />
                          )}
                        </td>

                        <td className="p-3">{item.room_name}</td>
                        <td className="p-3 font-medium">{item.item_name}</td>
                        <td className="p-3">{item.unit}</td>
                        <td className="p-3">{item.width || "-"}</td>
                        <td className="p-3">{item.height || "-"}</td>

                        <td className="p-3 text-right">
                          {item.total_qty} {item.unit}
                        </td>
                        <td className="p-3 text-right text-green-600">
                          {item.confirmed_qty}
                        </td>
                        <td className="p-3 text-right text-blue-600">
                          {item.draft_qty}
                        </td>

                        <td className="p-3 text-right">
                          <span className="text-green-600 font-medium">
                            {item.available_qty}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
