import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Trash2, Plus } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

export const EditablePRItemsTable = memo(function EditablePRItemsTable({
  items,
  setItems,
  categories,
}) {
  const addItem = useCallback(() => {
    const newItem = {
      id: Date.now(),
      name: '',
      category: '',
      room_name: '',
      unit: 'no',
      width: null,
      height: null,
      quantity: 1,
    };
    setItems((prev) => [...prev, newItem]);
    toast.success('New row added');
  }, [setItems]);

  const updateItem = useCallback(
    (index, field, value) => {
      setItems((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, [field]: value };

          // Auto compute sqft quantity
          if (['width', 'height', 'unit'].includes(field)) {
            if (updated.unit === 'sqft' && updated.width && updated.height) {
              updated.quantity = parseFloat(updated.width) * parseFloat(updated.height);
            }
          }

          return updated;
        })
      );
    },
    [setItems]
  );

  const duplicateItem = useCallback(
    (index) => {
      setItems((prev) => {
        const clone = { ...prev[index], id: Date.now() };
        toast.success('Item duplicated');
        return [
          ...prev.slice(0, index + 1),
          clone,
          ...prev.slice(index + 1),
        ];
      });
    },
    [setItems]
  );

  const removeItem = useCallback(
    (index) => {
      if (items.length === 1) {
        toast.error('At least one item is required');
        return;
      }
      setItems((prev) => prev.filter((_, i) => i !== index));
      toast.success('Item removed');
    },
    [setItems, items.length]
  );

  // Check if basic fields are filled
  const isRowValid = useCallback((item) => {
    return !!(item.name?.trim() && item.category);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Total Items: {items.length}
        </div>
        <Button type="button" onClick={addItem} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="p-2 border-b font-semibold text-left w-[200px]">Item Name *</th>
              <th className="p-2 border-b font-semibold text-left w-[150px]">Category *</th>
              <th className="p-2 border-b font-semibold text-left w-[150px]">Room</th>
              <th className="p-2 border-b font-semibold text-left w-[100px]">Unit *</th>
              <th className="p-2 border-b font-semibold text-left w-[90px]">Width</th>
              <th className="p-2 border-b font-semibold text-left w-[90px]">Height</th>
              <th className="p-2 border-b font-semibold text-right w-[100px]">Quantity *</th>
              <th className="p-2 border-b font-semibold text-center w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isValid = isRowValid(item);
              const isSqft = item.unit === 'sqft';

              return (
                <tr key={item.id} className="border-b bg-white hover:bg-slate-50">
                  {/* Item Name */}
                  <td className="p-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="Enter item name"
                      className="h-8 text-sm"
                    />
                  </td>

                  {/* Category */}
                  <td className="p-2">
                    <Select
                      value={item.category}
                      onValueChange={(value) => updateItem(index, 'category', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.category_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Room Name */}
                  <td className="p-2">
                    <Input
                      value={item.room_name || ''}
                      onChange={(e) => updateItem(index, 'room_name', e.target.value)}
                      placeholder="Optional"
                      className="h-8 text-sm"
                    />
                  </td>

                  {/* Unit */}
                  <td className="p-2">
                    <Select
                      value={item.unit}
                      onValueChange={(value) => updateItem(index, 'unit', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sqft">Sq.ft</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="lumpsum">Lumpsum</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Width */}
                  <td className="p-2">
                    <Input
                      type="number"
                      value={item.width || ''}
                      onChange={(e) => updateItem(index, 'width', e.target.value)}
                      disabled={!isSqft}
                      placeholder={isSqft ? '0' : '-'}
                      className={`h-8 text-sm text-right ${
                        !isSqft ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>

                  {/* Height */}
                  <td className="p-2">
                    <Input
                      type="number"
                      value={item.height || ''}
                      onChange={(e) => updateItem(index, 'height', e.target.value)}
                      disabled={!isSqft}
                      placeholder={isSqft ? '0' : '-'}
                      className={`h-8 text-sm text-right ${
                        !isSqft ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>

                  {/* Quantity */}
                  <td className="p-2">
                    <Input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      readOnly={isSqft}
                      placeholder="0"
                      className={`h-8 text-sm text-right ${
                        isSqft ? 'bg-gray-100 text-gray-400' : ''
                      }`}
                    />
                  </td>
                
                  {/* Actions */}
                  <td className="p-2">
                    <div className="flex gap-1 justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateItem(index)}
                        title="Duplicate"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Item Name and Category are required</li>
          <li>For Sq.ft unit, enter Width and Height - Quantity will auto-calculate</li>
          <li>Use Duplicate button to quickly add similar items</li>
        </ul>
      </div>
    </div>
  );
});
