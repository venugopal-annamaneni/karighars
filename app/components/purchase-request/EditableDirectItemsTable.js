"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

export default function EditableDirectItemsTable({
  items,
  setItems,
  categories
}) {
  const update = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const remove = (id) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const add = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        category: "",
        room_name: "",
        unit: "no",
        width: "",
        height: "",
        quantity: 1
      }
    ]);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-3 text-left w-[20%]">Item Name</th>
            <th className="p-3 text-left w-[15%]">Category</th>
            <th className="p-3 text-left w-[15%]">Room</th>
            <th className="p-3 text-left w-[8%]">Unit</th>
            <th className="p-3 text-right w-[10%]">Width</th>
            <th className="p-3 text-right w-[10%]">Height</th>
            <th className="p-3 text-right w-[10%]">Qty</th>
            <th className="p-3 text-center w-[6%]">Remove</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              {/* Name */}
              <td className="p-3">
                <Input
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => update(item.id, "name", e.target.value)}
                  className="h-9"
                />
              </td>

              {/* Category */}
              <td className="p-3">
                <Select
                  value={item.category}
                  onValueChange={(v) => update(item.id, "category", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>

              {/* Room */}
              <td className="p-3">
                <Input
                  placeholder="Room"
                  value={item.room_name}
                  onChange={(e) => update(item.id, "room_name", e.target.value)}
                  className="h-9"
                />
              </td>

              {/* Unit */}
              <td className="p-3">
                <Select
                  value={item.unit}
                  onValueChange={(v) => update(item.id, "unit", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="sqft">Sqft</SelectItem>
                    <SelectItem value="lumpsum">Lumpsum</SelectItem>
                  </SelectContent>
                </Select>
              </td>

              {/* Width */}
              <td className="p-3">
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 w-full text-right"
                  placeholder="0"
                  value={item.width}
                  onChange={(e) => update(item.id, "width", e.target.value)}
                />
              </td>

              {/* Height */}
              <td className="p-3">
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 w-full text-right"
                  placeholder="0"
                  value={item.height}
                  onChange={(e) => update(item.id, "height", e.target.value)}
                />
              </td>

              {/* Quantity */}
              <td className="p-3 text-right">
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 w-full text-right"
                  value={item.quantity}
                  onChange={(e) => update(item.id, "quantity", e.target.value)}
                />
              </td>

              {/* Remove */}
              <td className="p-3 text-center">
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => remove(item.id)}
                    className="text-destructive hover:text-destructive h-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Row Button */}
      <div className="p-3 border-t">
        <Button variant="outline" onClick={add} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>
    </div>
  );
}
