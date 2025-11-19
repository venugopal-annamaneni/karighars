"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  PackagePlus,
  Calendar,
  User,
  Building2,
  Link2,
  IndianRupee,
  Edit3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PURCHASE_REQUEST_STATUS, USER_ROLE } from '@/app/constants';
import Link from 'next/link';

// Helper function to check if unit is area-based (sqft)
const isAreaBasedUnit = (unit) => {
  if (!unit) return false;
  const areaUnits = ['sqft', 'sq.ft', 'square feet', 'sq ft', 'sq. ft'];
  return areaUnits.some(au => unit.toLowerCase().includes(au.toLowerCase()));
};

export default function ViewPurchaseRequestPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;
  const prId = params.prId;

  const [prDetail, setPRDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchPRDetail();
  }, [projectId, prId]);

  const fetchPRDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}`);
      if (res.ok) {
        const data = await res.json();
        setPRDetail(data);
      } else {
        toast.error('Failed to load purchase request');
        router.push(`/projects/${projectId}/purchase-requests`);
      }
    } catch (error) {
      console.error('Error fetching PR detail:', error);
      toast.error('Error loading purchase request');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePR = async () => {
    if (!confirm(`Are you sure you want to cancel PR ${prDetail?.purchase_request?.pr_number}?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Purchase request cancelled successfully');
        router.push(`/projects/${projectId}/purchase-requests`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to cancel purchase request');
      }
    } catch (error) {
      console.error('Error deleting PR:', error);
      toast.error('Error cancelling purchase request');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || '';
    const variants = {
      'draft': 'secondary',
      'confirmed': 'default',
      'submitted': 'default',
      'approved': 'default',
      'rejected': 'destructive',
      'cancelled': 'outline'
    };

    const icons = {
      'draft': <Clock className="h-4 w-4" />,
      'confirmed': <CheckCircle2 className="h-4 w-4" />,
      'submitted': <PackagePlus className="h-4 w-4" />,
      'approved': <CheckCircle2 className="h-4 w-4" />,
      'rejected': <XCircle className="h-4 w-4" />,
      'cancelled': <XCircle className="h-4 w-4" />
    };

    const className = {
      'cancelled': 'bg-red-700 text-red-100'
    }

    return (
      <Badge variant={variants[statusLower] || 'default'} className={`gap-1 ${className[statusLower]}`}>
        {icons[statusLower]}
        {status}
      </Badge>
    );
  };

  const canDeletePR = session?.user?.role === USER_ROLE.ADMIN;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading purchase request...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!prDetail) {
    return null;
  }

  const pr = prDetail.purchase_request;
  const items = prDetail.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${projectId}/purchase-requests`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Purchase Requests
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{pr.pr_number}</h1>
            {getStatusBadge(pr.status)}
          </div>
          <p className="text-muted-foreground">
            Created by {pr.created_by_name} on {formatDate(pr.created_at)}
          </p>
        </div>

        <div className="flex gap-2">
          {canDeletePR && (
            <Link href={`/projects/${projectId}/purchase-requests/${prId}/edit`}>
              <Button variant="outline" className="gap-2">
                <Edit3 className="h-4 w-4" />
                Edit PR
              </Button>
            </Link>
          )}
          
          {canDeletePR && pr.status !== 'cancelled' && (
            <Button
              variant="destructive"
              onClick={handleDeletePR}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Cancel PR
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* PR Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Request Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Vendor
              </div>
              <p className="font-medium">{pr.vendor_name || 'Not assigned'}</p>
              {pr.contact_person && (
                <p className="text-sm text-muted-foreground">{pr.contact_person}</p>
              )}
              {pr.vendor_phone && (
                <p className="text-sm text-muted-foreground">{pr.vendor_phone}</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Expected Delivery
              </div>
              <p className="font-medium">
                {pr.expected_delivery_date ? formatDate(pr.expected_delivery_date) : 'Not set'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Created By
              </div>
              <p className="font-medium">{pr.created_by_name}</p>
              <p className="text-sm text-muted-foreground">{formatDate(pr.created_at)}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PackagePlus className="h-4 w-4" />
                Items
              </div>
              <p className="font-medium">{items.length} items</p>
            </div>
          </div>

          {pr.notes && (
            <div className="mt-6 pt-6 border-t space-y-1">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{pr.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PR Pricing Summary */}
      {(pr.items_value || pr.gst_amount || pr.final_value) && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Purchase Request Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Items Value</p>
                <p className="text-2xl font-bold">
                  {pr.items_value ? formatCurrency(pr.items_value) : '-'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">GST Amount</p>
                <p className="text-2xl font-bold">
                  {pr.gst_amount ? formatCurrency(pr.gst_amount) : '-'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Final Value</p>
                <p className="text-3xl font-bold text-primary">
                  {pr.final_value ? formatCurrency(pr.final_value) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Request Items - Split by Flow Type */}
      <PRItemsByFlowType items={items} getStatusBadge={getStatusBadge}/>
    </div>
  );
}

// Component to display PR Items split by Flow Type
function PRItemsByFlowType({ items, getStatusBadge }) {
  // Separate items by flow type
  const fullItemFlowItems = [];
  const componentFlowEstimationItems = {};
  const directPurchaseItems = [];

  items.forEach(item => {
    debugger;
    // Check if it's a direct purchase item
    if (item.is_direct_purchase) {
      directPurchaseItems.push(item);
      return;
    }

    const hasLinks = item.estimation_links && item.estimation_links.length > 0;

    if (hasLinks) {
      // Check if all links have weightage = 1.0 (Full Item Flow)
      const allWeightageOne = item.estimation_links.every(link => parseFloat(link.weightage) === 1.0);

      if (allWeightageOne) {
        fullItemFlowItems.push(item);
      } else {
        // Component Flow - group by estimation item
        item.estimation_links.forEach(link => {
          const estItemKey = link.stable_estimation_item_id;
          if (!componentFlowEstimationItems[estItemKey]) {
            componentFlowEstimationItems[estItemKey] = {
              category: link.estimation_item_category,
              room: link.estimation_item_room,
              name: link.estimation_item_name,
              unit: link.estimation_item_unit,
              width: link.estimation_item_width,
              height: link.estimation_item_height,
              linked_qty: link.linked_qty,
              components: []
            };
          }
          componentFlowEstimationItems[estItemKey].components.push({
            pr_item_name: item.purchase_request_item_name,
            pr_item_id: item.id,
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
            gst_percentage: item.gst_percentage,
            gst_amount: item.gst_amount,
            item_total: item.item_total,
            status: item.status,
            weightage: link.weightage,
            notes: link.notes
          });
        });
      }
    } else {
      // No links - treat as full item flow (shouldn't happen for new items)
      fullItemFlowItems.push(item);
    }
  });

  return (
    <div className="space-y-6">
      {/* Full Item Flow Section */}
      {fullItemFlowItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Full Item Fulfillment</CardTitle>
            <CardDescription>Items ordered as complete units from estimation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium" width="10%">Room Name</th>
                    <th className="text-left p-3 font-medium" width="10%">Category</th>
                    <th className="text-left p-3 font-medium" width="20%">Item Name</th>
                    <th className="text-left p-3 font-medium" width="5%">Unit</th>
                    <th className="text-right p-3 font-medium" width="5%">Width</th>
                    <th className="text-right p-3 font-medium" width="5%">Height</th>
                    <th className="text-right p-3 font-medium" width="5%">Qty</th>
                    <th className="text-right p-3 font-medium" width="7%">Unit Price</th>
                    <th className="text-right p-3 font-medium" width="8%">Subtotal</th>
                    <th className="text-right p-3 font-medium" width="5%">GST ({fullItemFlowItems[0]?.gst_percentage || 0}%)</th>
                    <th className="text-right p-3 font-medium" width="10%">Total</th>
                    <th className="text-center p-3 font-medium" width="10%">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fullItemFlowItems.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-accent/50">
                      <td className="p-3">{item.estimation_links[0].estimation_item_room}</td>
                      <td className="p-3 capitalize">{item.estimation_links[0].estimation_item_category}</td>
                      <td className="p-3 font-medium">{item.purchase_request_item_name}</td>
                      <td className="p-3">{item.unit}</td>
                      <td className="p-3 text-right">
                        {isAreaBasedUnit(item.unit) ? (item.width || '-') : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {isAreaBasedUnit(item.unit) ? (item.height || '-') : '-'}
                      </td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">
                        {item.unit_price ? formatCurrency(item.unit_price) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {item.subtotal ? formatCurrency(item.subtotal) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {item.gst_amount ? formatCurrency(item.gst_amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {item.item_total ? formatCurrency(item.item_total) : '-'}
                      </td>
                      <td className="p-3 text-center">
                        {/* <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'} className={`text-xs`}>
                          {item.status}
                        </Badge> */}
                        {getStatusBadge(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 border-t-2">
                  <tr>
                    <td colSpan="6" className="p-3 text-right font-semibold">Total:</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(fullItemFlowItems.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(fullItemFlowItems.reduce((sum, item) => sum + (parseFloat(item.gst_amount) || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-semibold text-primary">
                      {formatCurrency(fullItemFlowItems.reduce((sum, item) => sum + (parseFloat(item.item_total) || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Component Flow Section */}
      {Object.keys(componentFlowEstimationItems).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Component-wise Fulfillment</CardTitle>
            <CardDescription>Estimation items fulfilled through component breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ComponentFlowTable estimationItems={componentFlowEstimationItems} />
          </CardContent>
        </Card>
      )}

      {/* Direct Purchase Section */}
      {directPurchaseItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Direct Purchase Items</CardTitle>
            <CardDescription>Ad-hoc items not linked to estimation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium" width="10%">Room Name</th>
                    <th className="text-left p-3 font-medium" width="10%">Category</th>
                    <th className="text-left p-3 font-medium" width="20%">Item Name</th>
                    <th className="text-right p-3 font-medium" width="5%">Qty</th>
                    <th className="text-left p-3 font-medium" width="5%"> Unit</th>
                    <th className="text-right p-3 font-medium" width="7%">Unit Price</th>
                    <th className="text-right p-3 font-medium" width="8%">Subtotal</th>
                    <th className="text-right p-3 font-medium">GST ({directPurchaseItems[0]?.gst_percentage || 0}%)</th>
                    <th className="text-right p-3 font-medium" width="10%">Total</th>
                    <th className="text-center p-3 font-medium" width="10%">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {directPurchaseItems.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-accent/50">
                      <td className="p-3">{item.room_name || '-'}</td>
                      <td className="p-3 capitalize">{item.category || '-'}</td>
                      <td className="p-3 font-medium">{item.purchase_request_item_name}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3">{item.unit}</td>
                      <td className="p-3 text-right">
                        {item.unit_price ? formatCurrency(item.unit_price) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {item.subtotal ? formatCurrency(item.subtotal) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {item.gst_amount ? formatCurrency(item.gst_amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {item.item_total ? formatCurrency(item.item_total) : '-'}
                      </td>
                      <td className="p-3 text-center">
                        {/* <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                          {item.status}
                        </Badge> */}
                        {getStatusBadge(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 border-t-2">
                  <tr>
                    <td colSpan="6" className="p-3 text-right font-semibold">Total:</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(directPurchaseItems.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(directPurchaseItems.reduce((sum, item) => sum + (parseFloat(item.gst_amount) || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-semibold text-primary">
                      {formatCurrency(directPurchaseItems.reduce((sum, item) => sum + (parseFloat(item.item_total) || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {fullItemFlowItems.length === 0 && Object.keys(componentFlowEstimationItems).length === 0 && directPurchaseItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No items in this purchase request</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Component Flow Table - Components first, then linked estimation item
function ComponentFlowTable({ estimationItems }) {
  // Calculate total weightage for each estimation item
  const calculateTotalWeightage = (components) => {
    return components.reduce((sum, comp) => sum + parseFloat(comp.weightage), 0);
  };

  return (
    <div className="space-y-6">
      {Object.entries(estimationItems).map(([itemKey, estItem]) => {
        const totalWeightage = calculateTotalWeightage(estItem.components);
        const isFullyFulfilled = Math.abs(totalWeightage - 1.0) < 0.01;

        return (
          <div key={itemKey} className="border rounded-lg overflow-hidden">
            {/* Components Table */}
            <div className="bg-background">
              <div className="bg-muted px-4 py-2 border-b">
                <div className="flex items-center gap-2">
                  <PackagePlus className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">
                    Purchase Request Components ({estItem.components.length} items)
                  </h4>
                </div>
              </div>
              
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Component Name</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-right p-3 font-medium">Unit Price</th>
                    <th className="text-right p-3 font-medium">Subtotal</th>
                    <th className="text-right p-3 font-medium">GST ({estItem.components[0]?.gst_percentage || 0}%)</th>
                    <th className="text-right p-3 font-medium">Total</th>
                    <th className="text-right p-3 font-medium">Weightage (%)</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {estItem.components.map((comp, idx) => (
                    <tr key={`${comp.pr_item_id}-${idx}`} className="border-t hover:bg-accent/50">
                      <td className="p-3 font-medium">{comp.pr_item_name}</td>
                      <td className="p-3 text-right">{comp.quantity}</td>
                      <td className="p-3">{comp.unit}</td>
                      <td className="p-3 text-right">
                        {comp.unit_price ? formatCurrency(comp.unit_price) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {comp.subtotal ? formatCurrency(comp.subtotal) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {comp.gst_amount ? formatCurrency(comp.gst_amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {comp.item_total ? formatCurrency(comp.item_total) : '-'}
                      </td>
                      <td className="p-3 text-right">{(parseFloat(comp.weightage) * 100).toFixed(1)}%</td>
                      <td className="p-3 text-center">
                        <Badge variant={comp.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                          {comp.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 border-t-2">
                  <tr>
                    <td colSpan="4" className="p-3 text-right font-semibold">Total:</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(estItem.components.reduce((sum, comp) => sum + (parseFloat(comp.subtotal) || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(estItem.components.reduce((sum, comp) => sum + (parseFloat(comp.gst_amount) || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-semibold text-primary">
                      {formatCurrency(estItem.components.reduce((sum, comp) => sum + (parseFloat(comp.item_total) || 0), 0))}
                    </td>
                    <td colSpan="2"></td>
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
                        <p className="text-blue-900">{estItem.room}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Category</p>
                        <p className="text-blue-900 capitalize">{estItem.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Item Name</p>
                        <p className="text-blue-900 font-medium">{estItem.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Dimensions</p>
                        <p className="text-blue-900">
                          {estItem.width && estItem.height 
                            ? `${estItem.width} × ${estItem.height} = ${estItem.linked_qty} ${estItem.unit}`
                            : `${estItem.linked_qty} ${estItem.unit}`
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
    </div>
  );
}
