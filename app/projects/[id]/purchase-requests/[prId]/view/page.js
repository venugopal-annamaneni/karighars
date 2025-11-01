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
  Edit,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  PackagePlus,
  Calendar,
  User,
  Building2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
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
    if (!confirm(`Are you sure you want to cancel PR ${prDetail?.purchase_request?.pr_number}? This will revert all items to Queued status.`)) {
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
    const variants = {
      [PURCHASE_REQUEST_STATUS.DRAFT]: 'secondary',
      [PURCHASE_REQUEST_STATUS.SUBMITTED]: 'default',
      [PURCHASE_REQUEST_STATUS.APPROVED]: 'success',
      [PURCHASE_REQUEST_STATUS.REJECTED]: 'destructive',
      [PURCHASE_REQUEST_STATUS.CANCELLED]: 'outline'
    };

    const icons = {
      [PURCHASE_REQUEST_STATUS.DRAFT]: <Clock className="h-4 w-4" />,
      [PURCHASE_REQUEST_STATUS.SUBMITTED]: <PackagePlus className="h-4 w-4" />,
      [PURCHASE_REQUEST_STATUS.APPROVED]: <CheckCircle2 className="h-4 w-4" />,
      [PURCHASE_REQUEST_STATUS.REJECTED]: <XCircle className="h-4 w-4" />,
      [PURCHASE_REQUEST_STATUS.CANCELLED]: <XCircle className="h-4 w-4" />
    };

    return (
      <Badge variant={variants[status] || 'default'} className="gap-1">
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const canDeletePR = session?.user?.role === USER_ROLE.ADMIN;
  const canEditPR = (session?.user?.role === USER_ROLE.ESTIMATOR || session?.user?.role === USER_ROLE.ADMIN) 
    && prDetail?.purchase_request?.status === PURCHASE_REQUEST_STATUS.DRAFT;

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
  const items = prDetail.items;

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

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
          {canDeletePR && pr.status !== PURCHASE_REQUEST_STATUS.CANCELLED && (
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

          {pr.payment_terms && (
            <div className="mt-6 pt-6 border-t space-y-1">
              <p className="text-sm text-muted-foreground">Payment Terms</p>
              <p>{pr.payment_terms}</p>
            </div>
          )}

          {pr.remarks && (
            <div className="mt-4 space-y-1">
              <p className="text-sm text-muted-foreground">Remarks</p>
              <p className="text-sm">{pr.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items by Category */}
      <div className="space-y-6">
        {Object.entries(itemsByCategory).map(([category, categoryItems]) => {
          const categoryTotal = categoryItems.reduce((sum, item) => sum + parseFloat(item.item_total || 0), 0);

          return (
            <Card key={category}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="capitalize">{category}</CardTitle>
                    <CardDescription>{categoryItems.length} items</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Category Total</p>
                    <p className="text-xl font-bold">{formatCurrency(categoryTotal)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Room</th>
                        <th className="text-left p-3 text-sm font-medium">Item Name</th>
                        <th className="text-right p-3 text-sm font-medium">Qty</th>
                        <th className="text-left p-3 text-sm font-medium">Unit</th>
                        <th className="text-right p-3 text-sm font-medium">Unit Price</th>
                        <th className="text-right p-3 text-sm font-medium">Subtotal</th>
                        <th className="text-right p-3 text-sm font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3 text-sm">{item.room_name}</td>
                          <td className="p-3 text-sm">{item.item_name}</td>
                          <td className="p-3 text-sm text-right">{item.quantity}</td>
                          <td className="p-3 text-sm">{item.unit}</td>
                          <td className="p-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="p-3 text-sm text-right">{formatCurrency(item.subtotal)}</td>
                          <td className="p-3 text-sm text-right font-medium">{formatCurrency(item.item_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatCurrency(pr.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST:</span>
              <span className="font-medium">{formatCurrency(pr.gst_amount)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold">{formatCurrency(pr.final_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
