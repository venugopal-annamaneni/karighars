"use client";

import { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { PURCHASE_REQUEST_STATUS, USER_ROLE } from '@/app/constants';
import Link from 'next/link';

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

    return (
      <Badge variant={variants[statusLower] || 'default'} className="gap-1">
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

      {/* Purchase Request Items - Split by Flow Type */}
      <PRItemsByFlowType items={items} />

      {/* Info Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Pricing information will be captured when the vendor provides their Bill of Quantities (BOQ). This feature is coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Component to display PR Items split by Flow Type
function PRItemsByFlowType({ items }) {
  // Separate items by flow type based on weightage
  const fullItemFlowItems = [];
  const componentFlowEstimationItems = {};

  items.forEach(item => {
    const hasLinks = item.estimation_links && item.estimation_links.length > 0;
    
    if (hasLinks) {
      // Check if all links have weightage = 1.0 (Full Item Flow)
      const allWeightageOne = item.estimation_links.every(link => parseFloat(link.weightage) === 1.0);
      
      if (allWeightageOne) {
        fullItemFlowItems.push(item);
      } else {
        // Component Flow - group by estimation item
        item.estimation_links.forEach(link => {
          const estItemKey = link.estimation_item_id;
          if (!componentFlowEstimationItems[estItemKey]) {
            componentFlowEstimationItems[estItemKey] = {
              category: link.estimation_item_category,
              room: link.estimation_item_room,
              name: link.estimation_item_name,
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
            status: item.status,
            weightage: link.weightage,
            notes: link.notes
          });
        });
      }
    } else {
      // No links - treat as full item flow
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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Item Name</th>
                    <th className="text-right p-3 font-medium">Width</th>
                    <th className="text-right p-3 font-medium">Height</th>
                    <th className="text-right p-3 font-medium">Quantity</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fullItemFlowItems.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-accent/50">
                      <td className="p-3 font-medium">{item.purchase_request_item_name}</td>
                      <td className="p-3 text-right">{item.width || '-'}</td>
                      <td className="p-3 text-right">{item.height || '-'}</td>
                      <td className="p-3 text-right font-medium">{item.quantity}</td>
                      <td className="p-3">{item.unit}</td>
                      <td className="p-3 text-center">
                        <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
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

      {/* Empty State */}
      {fullItemFlowItems.length === 0 && Object.keys(componentFlowEstimationItems).length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No items in this purchase request</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Component Flow Table with expandable components
function ComponentFlowTable({ estimationItems }) {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (itemKey) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3 font-medium">Category</th>
            <th className="text-left p-3 font-medium">Room</th>
            <th className="text-left p-3 font-medium">Estimation Item</th>
            <th className="text-right p-3 font-medium">Quantity</th>
            <th className="text-center p-3 font-medium w-[120px]">Components</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(estimationItems).map(([itemKey, estItem]) => {
            const isExpanded = expandedItems[itemKey];
            const componentsCount = estItem.components.length;

            return (
              <>
                {/* Estimation Item Row */}
                <tr key={itemKey} className="border-t hover:bg-accent/50">
                  <td className="p-3 capitalize">{estItem.category}</td>
                  <td className="p-3">{estItem.room}</td>
                  <td className="p-3 font-medium">{estItem.name}</td>
                  <td className="p-3 text-right">{estItem.linked_qty}</td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleItem(itemKey)}
                      className="h-8 gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show ({componentsCount})
                        </>
                      )}
                    </Button>
                  </td>
                </tr>

                {/* Expanded Components Row */}
                {isExpanded && (
                  <tr className="bg-accent/20">
                    <td colSpan="5" className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                            Purchase Request Components
                          </h4>
                        </div>
                        <div className="border rounded-lg overflow-hidden bg-background">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2 font-medium">Component Name</th>
                                <th className="text-right p-2 font-medium">Width</th>
                                <th className="text-right p-2 font-medium">Height</th>
                                <th className="text-right p-2 font-medium">Quantity</th>
                                <th className="text-left p-2 font-medium">Unit</th>
                                <th className="text-right p-2 font-medium">Weightage (%)</th>
                                <th className="text-center p-2 font-medium">Status</th>
                                <th className="text-left p-2 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {estItem.components.map((comp, idx) => (
                                <tr key={`${comp.pr_item_id}-${idx}`} className="border-t">
                                  <td className="p-2 font-medium">{comp.pr_item_name}</td>
                                  <td className="p-2 text-right">{comp.width || '-'}</td>
                                  <td className="p-2 text-right">{comp.height || '-'}</td>
                                  <td className="p-2 text-right">{comp.quantity}</td>
                                  <td className="p-2">{comp.unit}</td>
                                  <td className="p-2 text-right">{(parseFloat(comp.weightage) * 100).toFixed(1)}%</td>
                                  <td className="p-2 text-center">
                                    <Badge variant={comp.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                                      {comp.status}
                                    </Badge>
                                  </td>
                                  <td className="p-2 text-muted-foreground italic">
                                    {comp.notes || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
