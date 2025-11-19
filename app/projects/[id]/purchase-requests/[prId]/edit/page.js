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
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  AlertCircle,
  Lock,
  Edit3,
  Package,
  Layers,
  ShoppingCart,
  Link2,
  PackagePlus
} from 'lucide-react';
import { toast } from 'sonner';
import { USER_ROLE } from '@/app/constants';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

// Helper function to check if unit is area-based (sqft)
const isAreaBasedUnit = (unit) => {
  if (!unit) return false;
  const areaUnits = ['sqft', 'sq.ft', 'square feet', 'sq ft', 'sq. ft'];
  return areaUnits.some(au => unit.toLowerCase().includes(au.toLowerCase()));
};

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
  const [hasChanges, setHasChanges] = useState(false);

  // Grouped items
  const [fullUnitItems, setFullUnitItems] = useState([]);
  const [componentGroups, setComponentGroups] = useState({});
  const [directItems, setDirectItems] = useState([]);

  // Validation state
  const [allocationData, setAllocationData] = useState(new Map());
  const [validationErrors, setValidationErrors] = useState({});

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
    }
  }, [canEdit, prId]);

  useEffect(() => {
    if (items.length > 0) {
      groupItems();
    }
  }, [items]);

  const fetchPRData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}`);
      if (res.ok) {
        const data = await res.json();
        setPRData(data.purchase_request);
        setItems(data.items || []);
        setOriginalItems(JSON.parse(JSON.stringify(data.items || [])));
        
        // Fetch allocation data for validation
        if (data.purchase_request?.estimation_id) {
          fetchAllocationData(data.purchase_request.estimation_id);
        }
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

  const fetchAllocationData = async (estimationId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/available-items`);
      if (res.ok) {
        const data = await res.json();
        const allocMap = new Map();
        (data.items || []).forEach(item => {
          allocMap.set(item.stable_item_id, {
            total_qty: item.total_qty,
            confirmed_qty: item.confirmed_qty || 0,
            draft_qty: item.draft_qty || 0,
            available_qty: item.available_qty,
            unit: item.unit
          });
        });
        setAllocationData(allocMap);
      }
    } catch (error) {
      console.error('Error fetching allocation data:', error);
    }
  };

  const groupItems = () => {
    const fullUnit = [];
    const componentGroupsMap = {};
    const direct = [];

    items.forEach(item => {
      // Direct purchase items
      if (item.is_direct_purchase) {
        direct.push(item);
        return;
      }

      const hasLinks = item.estimation_links && item.estimation_links.length > 0;

      if (hasLinks) {
        // Check if all links have weightage = 1.0 (Full Item Flow)
        const allWeightageOne = item.estimation_links.every(link => parseFloat(link.weightage) === 1.0);

        if (allWeightageOne) {
          fullUnit.push(item);
        } else {
          // Component Flow - group by estimation item
          item.estimation_links.forEach(link => {
            const estItemKey = link.stable_estimation_item_id;
            if (!componentGroupsMap[estItemKey]) {
              componentGroupsMap[estItemKey] = {
                category: link.estimation_item_category,
                room: link.estimation_item_room,
                name: link.estimation_item_name,
                unit: link.estimation_item_unit,
                width: link.estimation_item_width,
                height: link.estimation_item_height,
                linked_qty: link.linked_qty,
                stable_estimation_item_id: link.stable_estimation_item_id,
                components: []
              };
            }
            
            // Add component with its link info
            componentGroupsMap[estItemKey].components.push({
              ...item,
              link_info: link // Store link info with the item
            });
          });
        }
      } else {
        // No links - treat as full item flow (shouldn't happen for new items)
        fullUnit.push(item);
      }
    });

    setFullUnitItems(fullUnit);
    setComponentGroups(componentGroupsMap);
    setDirectItems(direct);
  };

  const handleItemChange = (stable_item_id, field, value) => {
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.stable_item_id === stable_item_id) {
          const updatedItem = { ...item, [field]: value };
          
          // Auto-calculate quantity for sqft units when width or height changes
          if ((field === 'width' || field === 'height') && isAreaBasedUnit(item.unit)) {
            const w = parseFloat(field === 'width' ? value : (item.width || 0)) || 0;
            const h = parseFloat(field === 'height' ? value : (item.height || 0)) || 0;
            updatedItem.quantity = w * h;
          }
          
          return updatedItem;
        }
        return item;
      });
      return updated;
    });
    setHasChanges(true);
  };

  const handleLinkChange = (stable_item_id, link_index, field, value) => {
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.stable_item_id === stable_item_id) {
          const newLinks = [...(item.estimation_links || [])];
          if (newLinks[link_index]) {
            newLinks[link_index] = { ...newLinks[link_index], [field]: value };
          }
          return { ...item, estimation_links: newLinks };
        }
        return item;
      });
      return updated;
    });
    setHasChanges(true);
  };

  const handleDeleteItem = (stable_item_id) => {
    const item = items.find(i => i.stable_item_id === stable_item_id);
    
    if (!item) return;
    
    if (item.lifecycle_status !== 'pending') {
      toast.error(`Cannot delete item with status: ${item.lifecycle_status}`);
      return;
    }

    setItems(prev => prev.filter(i => i.stable_item_id !== stable_item_id));
    setHasChanges(true);
    toast.success('Item marked for deletion');
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      // Check if there are changes
      if (!hasChanges) {
        toast.info('No changes to save');
        setSaving(false);
        return;
      }

      // Count deleted items for summary
      const deletedCount = originalItems.length - items.length;

      // Prepare ALL remaining items with their links
      // Items not included in this payload will be implicitly deleted
      const allItemsWithLinks = items.map(item => {
        const itemQty = parseFloat(item.quantity);
        
        // Update linked_qty in estimation_links to match item quantity
        // This is critical for validation
        const updatedLinks = (item.estimation_links || []).map(link => ({
          ...link,
          linked_qty: itemQty  // Sync linked_qty with item quantity
        }));
        
        return {
          stable_item_id: item.stable_item_id,
          purchase_request_item_name: item.purchase_request_item_name,
          quantity: itemQty,
          width: item.width ? parseFloat(item.width) : null,
          height: item.height ? parseFloat(item.height) : null,
          unit: item.unit,
          unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
          category: item.category,
          room_name: item.room_name,
          is_direct_purchase: item.is_direct_purchase,
          estimation_links: updatedLinks
        };
      });

      // Build change summary
      let changeSummary = '';
      if (deletedCount > 0 && items.length > 0) {
        changeSummary = `Edited items and deleted ${deletedCount} item(s)`;
      } else if (deletedCount > 0) {
        changeSummary = `Deleted ${deletedCount} item(s)`;
      } else {
        changeSummary = `Edited ${items.length} item(s)`;
      }

      // Single API call to save all changes
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          items: allItemsWithLinks,
          change_summary: changeSummary,
          vendor_id: prData.vendor_id,
          expected_delivery_date: prData.expected_delivery_date,
          notes: prData.notes
        })
      });

      if (!res.ok) {
        const error = await res.json();
        
        // Handle validation errors specifically
        if (error.details && Array.isArray(error.details)) {
          // Show all validation errors
          error.details.forEach(detail => {
            toast.error(detail, { duration: 6000 });
          });
          setSaving(false);
          return;
        }
        
        throw new Error(error.error || 'Failed to save changes');
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

      {/* Full Unit Items */}
      {fullUnitItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <CardTitle>Full Unit Fulfillment</CardTitle>
            </div>
            <CardDescription>
              Items fulfilling complete estimation items (weightage = 1.0)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">From Estimation</th>
                    <th className="text-left p-3 font-medium">PR Item</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-right p-3 font-medium">Width</th>
                    <th className="text-right p-3 font-medium">Height</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Unit Price</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fullUnitItems.map((item) => {
                    const isEditable = item.lifecycle_status === 'pending';
                    const estLink = item.estimation_links?.[0];
                    
                    return (
                      <tr key={item.stable_item_id} className="border-t hover:bg-accent/50">
                        <td className="p-3">
                          <div className="text-sm">
                            <div className="font-medium">{estLink?.estimation_item_name}</div>
                            <div className="text-muted-foreground text-xs">
                              {estLink?.estimation_item_room} • {estLink?.estimation_item_category}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {isEditable ? (
                            <Input
                              value={item.purchase_request_item_name}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'purchase_request_item_name', e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">{item.purchase_request_item_name}</span>
                          )}
                        </td>
                        <td className="p-3">{item.unit}</td>
                        
                        {/* Width - only for sqft units */}
                        <td className="p-3">
                          {isEditable && isAreaBasedUnit(item.unit) ? (
                            <Input
                              type="number"
                              value={item.width || ''}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'width', e.target.value)}
                              placeholder="Width"
                              className="h-8 text-right w-20"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-right block text-muted-foreground">-</span>
                          )}
                        </td>
                        
                        {/* Height - only for sqft units */}
                        <td className="p-3">
                          {isEditable && isAreaBasedUnit(item.unit) ? (
                            <Input
                              type="number"
                              value={item.height || ''}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'height', e.target.value)}
                              placeholder="Height"
                              className="h-8 text-right w-20"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-right block text-muted-foreground">-</span>
                          )}
                        </td>
                        
                        {/* Quantity - auto-calculated for sqft, manual for others */}
                        <td className="p-3">
                          {isEditable && !isAreaBasedUnit(item.unit) ? (
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'quantity', e.target.value)}
                              className="h-8 text-right"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-right block text-muted-foreground">{item.quantity || 0}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditable ? (
                            <Input
                              type="number"
                              value={item.unit_price || ''}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'unit_price', e.target.value)}
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
                              onClick={() => handleDeleteItem(item.stable_item_id)}
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
          </CardContent>
        </Card>
      )}

      {/* Component-wise Items */}
      {Object.keys(componentGroups).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-orange-600" />
              <CardTitle>Component-wise Fulfillment</CardTitle>
            </div>
            <CardDescription>
              Items broken down into components with weightage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(componentGroups).map(([estItemId, estItem]) => {
              const firstComp = estItem.components[0];
              const estLink = firstComp?.estimation_links?.[0];
              
              // Calculate total weightage for this group
              const totalWeightage = estItem.components.reduce((sum, comp) => {
                const linkIndex = comp.estimation_links?.findIndex(l => l.stable_estimation_item_id === estItemId);
                if (linkIndex !== -1) {
                  return sum + (parseFloat(comp.estimation_links[linkIndex]?.weightage) || 0);
                }
                return sum;
              }, 0);
              
              const isFullyFulfilled = Math.abs(totalWeightage - 1.0) < 0.01;
              
              return (
              <div key={estItemId} className="border rounded-lg p-4 bg-slate-50">
                {/* Estimation Item Header */}
                <div className="mb-4 pb-3 border-b">
                  <h3 className="font-semibold text-lg">{estItem.name}</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>{estItem.room}</span>
                    <span>•</span>
                    <span className="capitalize">{estItem.category}</span>
                    <span>•</span>
                    <span>{estItem.linked_qty} {estItem.unit}</span>
                  </div>
                </div>

                {/* Components Table */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Component Name</th>
                        <th className="text-left p-3 font-medium">Unit</th>
                        <th className="text-right p-3 font-medium">Width</th>
                        <th className="text-right p-3 font-medium">Height</th>
                        <th className="text-right p-3 font-medium">Qty</th>
                        <th className="text-right p-3 font-medium">Unit Price</th>
                        <th className="text-right p-3 font-medium">Weightage (%)</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-center p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estItem.components.map((comp) => {
                        const isEditable = comp.lifecycle_status === 'pending';
                        const linkIndex = comp.estimation_links?.findIndex(l => l.stable_estimation_item_id === estItemId);
                        
                        return (
                          <tr key={comp.stable_item_id} className="border-t hover:bg-accent/50">
                            <td className="p-3">
                              {isEditable ? (
                                <Input
                                  value={comp.purchase_request_item_name}
                                  onChange={(e) => handleItemChange(comp.stable_item_id, 'purchase_request_item_name', e.target.value)}
                                  className="h-8"
                                />
                              ) : (
                                <span className="text-muted-foreground">{comp.purchase_request_item_name}</span>
                              )}
                            </td>
                            <td className="p-3">{comp.unit}</td>
                            
                            {/* Width - only for sqft units */}
                            <td className="p-3">
                              {isEditable && isAreaBasedUnit(comp.unit) ? (
                                <Input
                                  type="number"
                                  value={comp.width || ''}
                                  onChange={(e) => handleItemChange(comp.stable_item_id, 'width', e.target.value)}
                                  placeholder="Width"
                                  className="h-8 text-right w-20"
                                  step="0.01"
                                />
                              ) : (
                                <span className="text-right block text-muted-foreground">-</span>
                              )}
                            </td>
                            
                            {/* Height - only for sqft units */}
                            <td className="p-3">
                              {isEditable && isAreaBasedUnit(comp.unit) ? (
                                <Input
                                  type="number"
                                  value={comp.height || ''}
                                  onChange={(e) => handleItemChange(comp.stable_item_id, 'height', e.target.value)}
                                  placeholder="Height"
                                  className="h-8 text-right w-20"
                                  step="0.01"
                                />
                              ) : (
                                <span className="text-right block text-muted-foreground">-</span>
                              )}
                            </td>
                            
                            {/* Quantity - auto-calculated for sqft, manual for others */}
                            <td className="p-3">
                              {isEditable && !isAreaBasedUnit(comp.unit) ? (
                                <Input
                                  type="number"
                                  value={comp.quantity}
                                  onChange={(e) => handleItemChange(comp.stable_item_id, 'quantity', e.target.value)}
                                  className="h-8 text-right"
                                  step="0.01"
                                />
                              ) : (
                                <span className="text-right block text-muted-foreground">{comp.quantity || 0}</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isEditable ? (
                                <Input
                                  type="number"
                                  value={comp.unit_price || ''}
                                  onChange={(e) => handleItemChange(comp.stable_item_id, 'unit_price', e.target.value)}
                                  placeholder="0.00"
                                  className="h-8 text-right"
                                  step="0.01"
                                />
                              ) : (
                                <span className="text-right block text-muted-foreground">
                                  {comp.unit_price ? formatCurrency(comp.unit_price) : '-'}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {isEditable && linkIndex !== -1 ? (
                                <Input
                                  type="number"
                                  value={(parseFloat(comp.estimation_links[linkIndex].weightage) * 100).toFixed(1)}
                                  onChange={(e) => {
                                    const newWeightage = parseFloat(e.target.value) / 100;
                                    handleLinkChange(comp.stable_item_id, linkIndex, 'weightage', newWeightage);
                                  }}
                                  className="h-8 text-right"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                />
                              ) : (
                                <span className="text-right block text-muted-foreground">
                                  {(parseFloat(comp.link_info?.weightage || 0) * 100).toFixed(1)}%
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Badge 
                                variant={isEditable ? 'default' : 'secondary'}
                                className="text-xs gap-1"
                              >
                                {!isEditable && <Lock className="h-3 w-3" />}
                                {comp.lifecycle_status || 'pending'}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              {isEditable ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteItem(comp.stable_item_id)}
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
                    <tfoot className="bg-muted/50 border-t-2">
                      <tr>
                        <td colSpan="7" className="p-3 text-right font-semibold">Total Weightage:</td>
                        <td className="p-3 text-right font-semibold">
                          {(totalWeightage * 100).toFixed(1)}%
                        </td>
                        <td colSpan="1"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {/* Linked Estimation Item Footer */}
                <div className="bg-blue-50 border-t-2 border-blue-200">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Link2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-blue-900">Linked Estimation Item</h4>
                          {isFullyFulfilled ? (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              ✓ 100% Fulfilled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {(totalWeightage * 100).toFixed(1)}% Fulfilled
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-blue-600 font-medium">Room</p>
                            <p className="text-blue-900">{estLink?.estimation_item_room || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-600 font-medium">Category</p>
                            <p className="text-blue-900 capitalize">{estLink?.estimation_item_category || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-600 font-medium">Item Name</p>
                            <p className="text-blue-900 font-medium">{estLink?.estimation_item_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-600 font-medium">Dimensions</p>
                            <p className="text-blue-900">
                              {estLink?.estimation_item_width && estLink?.estimation_item_height 
                                ? `${estLink.estimation_item_width} × ${estLink.estimation_item_height} = ${estLink.linked_qty} ${estLink.estimation_item_unit}`
                                : `${estLink?.linked_qty || '-'} ${estLink?.estimation_item_unit || ''}`
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </CardContent>
        </Card>
      )}

      {/* Direct Purchase Items */}
      {directItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <CardTitle>Direct Purchase Items</CardTitle>
            </div>
            <CardDescription>
              Ad-hoc items not linked to estimation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Item Name</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-left p-3 font-medium">Room</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-right p-3 font-medium">Width</th>
                    <th className="text-right p-3 font-medium">Height</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Unit Price</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {directItems.map((item) => {
                    const isEditable = item.lifecycle_status === 'pending';
                    
                    return (
                      <tr key={item.stable_item_id} className="border-t hover:bg-accent/50">
                        <td className="p-3">
                          {isEditable ? (
                            <Input
                              value={item.purchase_request_item_name}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'purchase_request_item_name', e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">{item.purchase_request_item_name}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="capitalize">{item.category || '-'}</span>
                        </td>
                        <td className="p-3">{item.room_name || '-'}</td>
                        <td className="p-3">{item.unit}</td>
                        
                        {/* Width - only for sqft units */}
                        <td className="p-3">
                          {isEditable && isAreaBasedUnit(item.unit) ? (
                            <Input
                              type="number"
                              value={item.width || ''}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'width', e.target.value)}
                              placeholder="Width"
                              className="h-8 text-right w-20"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-right block text-muted-foreground">-</span>
                          )}
                        </td>
                        
                        {/* Height - only for sqft units */}
                        <td className="p-3">
                          {isEditable && isAreaBasedUnit(item.unit) ? (
                            <Input
                              type="number"
                              value={item.height || ''}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'height', e.target.value)}
                              placeholder="Height"
                              className="h-8 text-right w-20"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-right block text-muted-foreground">-</span>
                          )}
                        </td>
                        
                        {/* Quantity - auto-calculated for sqft, manual for others */}
                        <td className="p-3">
                          {isEditable && !isAreaBasedUnit(item.unit) ? (
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'quantity', e.target.value)}
                              className="h-8 text-right"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-right block text-muted-foreground">{item.quantity || 0}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditable ? (
                            <Input
                              type="number"
                              value={item.unit_price || ''}
                              onChange={(e) => handleItemChange(item.stable_item_id, 'unit_price', e.target.value)}
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
                              onClick={() => handleDeleteItem(item.stable_item_id)}
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
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {fullUnitItems.length === 0 && Object.keys(componentGroups).length === 0 && directItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No items in this purchase request</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between sticky bottom-0 bg-background py-4 border-t">
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
