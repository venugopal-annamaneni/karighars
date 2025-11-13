"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Plus,
  AlertCircle,
  History,
  Lock,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { USER_ROLE } from '@/app/constants';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function EditPurchaseRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const projectId = params.id;
  const prId = params.prId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prData, setPRData] = useState(null);
  const [items, setItems] = useState([]);
  const [originalItems, setOriginalItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Check permissions
  const canEdit = session?.user?.role === USER_ROLE.ESTIMATOR || session?.user?.role === USER_ROLE.ADMIN;

  useEffect(() => {
    if (session && !canEdit) {
      toast.error('You do not have permission to edit purchase requests');
      router.push(`/projects/${projectId}/purchase-requests/${prId}/view`);
    }
  }, [session, canEdit, router, projectId, prId]);

  useEffect(() => {
    if (canEdit) {
      fetchPRData();
      fetchVendors();
    }
  }, [canEdit, prId]);

  const fetchPRData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}`);
      if (res.ok) {
        const data = await res.json();
        setPRData(data.purchase_request);
        setItems(data.items || []);
        setOriginalItems(JSON.parse(JSON.stringify(data.items || [])));
      } else {
        toast.error('Failed to load purchase request');
      }
    } catch (error) {
      console.error('Error fetching PR:', error);
      toast.error('An error occurred while loading the purchase request');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`/api/vendors`);
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  const handleDeleteItem = (index) => {
    const item = items[index];
    
    if (item.lifecycle_status !== 'pending') {
      toast.error(`Cannot delete item with status: ${item.lifecycle_status}`);
      return;
    }

    setItems(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    toast.success('Item marked for deletion');
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      // Find items that were edited
      const editedItems = items
        .map((item, index) => {
          const original = originalItems.find(o => o.stable_item_id === item.stable_item_id);
          if (!original) return null;

          // Check if any field changed
          const hasChanged = 
            original.purchase_request_item_name !== item.purchase_request_item_name ||
            original.quantity !== item.quantity ||
            original.unit_price !== item.unit_price ||
            original.category !== item.category ||
            original.room_name !== item.room_name;

          if (hasChanged) {
            return {
              stable_item_id: item.stable_item_id,
              purchase_request_item_name: item.purchase_request_item_name,
              quantity: parseFloat(item.quantity),
              unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
              category: item.category,
              room_name: item.room_name
            };
          }
          return null;
        })
        .filter(Boolean);

      // Find items that were deleted
      const deletedItemIds = originalItems
        .filter(original => !items.find(i => i.stable_item_id === original.stable_item_id))
        .map(item => item.stable_item_id);

      if (editedItems.length === 0 && deletedItemIds.length === 0) {
        toast.info('No changes to save');
        return;
      }

      // Save edits
      if (editedItems.length > 0) {
        const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}/edit`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: editedItems,
            change_summary: `Edited ${editedItems.length} item(s)`,
            vendor_id: prData.vendor_id,
            expected_delivery_date: prData.expected_delivery_date,
            notes: prData.notes
          })
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to save changes');
        }
      }

      // Save deletions
      if (deletedItemIds.length > 0) {
        const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}/edit`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stable_item_ids: deletedItemIds
          })
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to delete items');
        }
      }

      toast.success('Purchase request updated successfully!');
      router.push(`/projects/${projectId}/purchase-requests/${prId}/view`);

    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!prData) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Purchase request not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/projects/${projectId}/purchase-requests/${prId}/view`}>
          <Button variant="ghost" size="sm" className="gap-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to View
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Edit {prData.pr_number}</h1>
              <Badge variant="outline" className="gap-1">
                <Edit3 className="h-3 w-3" />
                Version {items[0]?.version || 1}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Make changes to items with 'pending' status
            </p>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">
              Changes will create a new version
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Only items with 'pending' lifecycle status can be edited or deleted. 
              Click "Save Changes" to apply all modifications at once.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PR Header Info */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Vendor</Label>
              <p className="font-medium">{prData.vendor_name || 'Not assigned'}</p>
            </div>
            <div>
              <Label>Expected Delivery</Label>
              <p className="font-medium">
                {prData.expected_delivery_date 
                  ? new Date(prData.expected_delivery_date).toLocaleDateString()
                  : 'Not set'}
              </p>
            </div>
          </div>
          {prData.notes && (
            <div>
              <Label>Notes</Label>
              <p className="text-sm">{prData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Edit quantities and prices for pending items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Item Name</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-right p-3 font-medium">Quantity</th>
                  <th className="text-left p-3 font-medium">Unit</th>
                  <th className="text-right p-3 font-medium">Unit Price</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-center p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const isEditable = item.lifecycle_status === 'pending';
                  
                  return (
                    <tr key={item.stable_item_id || index} className="border-t hover:bg-accent/50">
                      <td className="p-3">
                        {isEditable ? (
                          <Input
                            value={item.purchase_request_item_name}
                            onChange={(e) => handleItemChange(index, 'purchase_request_item_name', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{item.purchase_request_item_name}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.is_direct_purchase ? (
                          <span className="capitalize">{item.category}</span>
                        ) : (
                          <span className="capitalize">
                            {item.estimation_links?.[0]?.estimation_item_category || '-'}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditable ? (
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="h-8 text-right"
                            step="0.01"
                          />
                        ) : (
                          <span className="text-right block text-muted-foreground">{item.quantity}</span>
                        )}
                      </td>
                      <td className="p-3">{item.unit}</td>
                      <td className="p-3">
                        {isEditable ? (
                          <Input
                            type="number"
                            value={item.unit_price || ''}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-right"
                            step="0.01"
                          />
                        ) : (
                          <span className="text-right block text-muted-foreground">
                            {item.unit_price ? formatCurrency(item.unit_price) : '-'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          variant={isEditable ? 'default' : 'secondary'}
                          className="text-xs gap-1"
                        >
                          {!isEditable && <Lock className="h-3 w-3" />}
                          {item.lifecycle_status || 'pending'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {isEditable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(index)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No items in this purchase request
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href={`/projects/${projectId}/purchase-requests/${prId}/view`}>
          <Button variant="outline">
            Cancel
          </Button>
        </Link>

        <Button
          onClick={handleSaveChanges}
          disabled={!hasChanges || saving}
          size="lg"
          className="gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
