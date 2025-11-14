"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";


const AREA_UNITS = ["sqft", "sq.ft", "square feet", "sq ft", "sq. ft"];

const isAreaUnit = (unit) => {
  if (!unit) return false;
  const u = unit.toLowerCase().trim();
  return AREA_UNITS.includes(u);
};

export default function ComponentsBreakdownTable({
  components,
  vendors,
  updateComponent,
  removeComponent,
  addComponent,
}) {
  const totalPct = components.reduce(
    (s, c) => s + (parseFloat(c.percentage) || 0),
    0
  );
  const pctOk = Math.abs(totalPct - 100) < 0.01;

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex justify-between items-center">
        <Label className="font-semibold">Components</Label>
        <div
          className={`text-sm font-medium ${
            pctOk ? "text-green-600" : "text-red-600"
          }`}
        >
          Total: {totalPct.toFixed(1)}% {pctOk && "✓"}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left font-medium w-[26%]">Component Name</th>
              <th className="p-3 text-left font-medium w-[15%]">Vendor</th>
              <th className="p-3 text-left font-medium w-[10%]">Unit</th>
              <th className="p-3 text-right font-medium w-[10%]">Width</th>
              <th className="p-3 text-right font-medium w-[10%]">Height</th>
              <th className="p-3 text-right font-medium w-[10%]">Quantity</th>
              <th className="p-3 text-right font-medium w-[8%]">%</th>
              <th className="p-3 text-center font-medium w-[6%]">Actions</th>
            </tr>
          </thead>

          <tbody>
            {components.map((comp, index) => {
              const areaUnit = isAreaUnit(comp.unit);

              return (
                <tr key={index} className="border-t">
                  {/* Component Name */}
                  <td className="p-3">
                    <Input
                      placeholder="Laminate 1mm / Plywood 18mm"
                      value={comp.name}
                      onChange={(e) =>
                        updateComponent(index, "name", e.target.value)
                      }
                      className="h-9"
                    />
                  </td>

                  {/* Vendor */}
                  <td className="p-3">
                    <Select
                      value={comp.vendor_id}
                      onValueChange={(v) =>
                        updateComponent(index, "vendor_id", v)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Unit */}
                  <td className="p-3">
                    <Select
                      value={comp.unit}
                      onValueChange={(v) => updateComponent(index, "unit", v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sqft">Sq.ft</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="lumpsum">Lumpsum</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Width / Height / Quantity */}
                  {areaUnit ? (
                    <>
                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={comp.width || ""}
                          onChange={(e) =>
                            updateComponent(index, "width", e.target.value)
                          }
                          className="h-9 w-20 text-right"
                        />
                      </td>

                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={comp.height || ""}
                          onChange={(e) =>
                            updateComponent(index, "height", e.target.value)
                          }
                          className="h-9 w-20 text-right"
                        />
                      </td>

                      <td className="p-3 text-right font-medium">
                        {comp.quantity || 0}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-center text-muted-foreground">
                        -
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        -
                      </td>

                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={comp.quantity}
                          onChange={(e) =>
                            updateComponent(index, "quantity", e.target.value)
                          }
                          className="h-9 w-24 text-right"
                          placeholder="0"
                        />
                      </td>
                    </>
                  )}

                  {/* Percentage */}
                  <td className="p-3 text-right">
                    <Input
                      type="number"
                      step="0.1"
                      value={comp.percentage}
                      onChange={(e) =>
                        updateComponent(index, "percentage", e.target.value)
                      }
                      className="h-9 w-20 text-right"
                      placeholder="0"
                    />
                  </td>

                  {/* Remove */}
                  <td className="p-3 text-center">
                    {components.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeComponent(index)}
                        className="h-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Component Button */}
      <Button
        onClick={addComponent}
        variant="outline"
        className="w-full gap-2 mt-2"
      >
        <Plus className="h-4 w-4" />
        Add Component
      </Button>
    </div>
  );
}
