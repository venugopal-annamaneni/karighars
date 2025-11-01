"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Eye, 
  Loader2,
  PackagePlus,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PURCHASE_REQUEST_STATUS, USER_ROLE } from '@/app/constants';
import Link from 'next/link';

export default function PurchaseRequestsPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchaseRequests();
  }, [projectId]);

  const fetchPurchaseRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests`);
      if (res.ok) {
        const data = await res.json();
        setPurchaseRequests(data.purchase_requests || []);
      } else {
        toast.error('Failed to load purchase requests');
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
      toast.error('Error loading purchase requests');
    } finally {
      setLoading(false);
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
      [PURCHASE_REQUEST_STATUS.DRAFT]: <Clock className="h-3 w-3" />,
      [PURCHASE_REQUEST_STATUS.SUBMITTED]: <PackagePlus className="h-3 w-3" />,
      [PURCHASE_REQUEST_STATUS.APPROVED]: <CheckCircle2 className="h-3 w-3" />,
      [PURCHASE_REQUEST_STATUS.REJECTED]: <XCircle className="h-3 w-3" />,
      [PURCHASE_REQUEST_STATUS.CANCELLED]: <XCircle className="h-3 w-3" />
    };

    return (
      <Badge variant={variants[status] || 'default'} className="gap-1">
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const canCreatePR = session?.user?.role === USER_ROLE.ESTIMATOR || session?.user?.role === USER_ROLE.ADMIN;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Purchase Requests</CardTitle>
              <CardDescription>
                Create and manage purchase requests from estimation items
              </CardDescription>
            </div>
            {canCreatePR && (
              <Link href={`/projects/${projectId}/purchase-requests/create`}>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create PR
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* PR Table */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading purchase requests...</p>
            </div>
          ) : purchaseRequests.length === 0 ? (
            <div className="text-center py-8">
              <PackagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No purchase requests yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first purchase request from queued estimation items
              </p>
              {canCreatePR && (
                <Link href={`/projects/${projectId}/purchase-requests/create`}>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First PR
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">PR Number</th>
                    <th className="text-left p-3 text-sm font-medium">Vendor</th>
                    <th className="text-center p-3 text-sm font-medium">Items</th>
                    <th className="text-center p-3 text-sm font-medium">Status</th>
                    <th className="text-right p-3 text-sm font-medium">Amount</th>
                    <th className="text-left p-3 text-sm font-medium">Expected Delivery</th>
                    <th className="text-left p-3 text-sm font-medium">Created</th>
                    <th className="text-center p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRequests.map((pr) => (
                    <tr 
                      key={pr.id} 
                      className="border-t hover:bg-accent/50 transition-colors"
                    >
                      <td className="p-3">
                        <p className="font-medium">{pr.pr_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {pr.created_by_name}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">{pr.vendor_name || '-'}</p>
                        {pr.contact_person && (
                          <p className="text-xs text-muted-foreground">{pr.contact_person}</p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline">{pr.items_count}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(pr.status)}
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-medium">{formatCurrency(pr.final_amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Inc. GST {formatCurrency(pr.gst_amount)}
                        </p>
                      </td>
                      <td className="p-3 text-sm">
                        {pr.expected_delivery_date ? formatDate(pr.expected_delivery_date) : '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {formatDate(pr.created_at)}
                      </td>
                      <td className="p-3 text-center">
                        <Link href={`/projects/${projectId}/purchase-requests/${pr.id}/view`}>
                          <Button size="sm" variant="ghost" className="gap-2">
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
