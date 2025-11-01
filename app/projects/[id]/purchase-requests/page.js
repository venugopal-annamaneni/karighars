"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Eye, 
  Trash2, 
  Calendar,
  PackagePlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PURCHASE_REQUEST_STATUS, ESTIMATION_ITEM_STATUS, USER_ROLE } from '@/app/constants';

export default function PurchaseRequestsPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [prDetail, setPRDetail] = useState(null);

  // Create PR state
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [createStep, setCreateStep] = useState(1); // 1: Select Items, 2: Details
  const [prFormData, setPRFormData] = useState({
    vendor_id: '',
    expected_delivery_date: '',
    remarks: '',
    payment_terms: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchPurchaseRequests();
    fetchVendors();
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

  const fetchAvailableItems = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/available-items`);
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data.items || []);
      } else {
        toast.error('Failed to load available items');
      }
    } catch (error) {
      console.error('Error fetching available items:', error);
      toast.error('Error loading available items');
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

  const fetchPRDetail = async (prId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}`);
      if (res.ok) {
        const data = await res.json();
        setPRDetail(data);
        setShowDetailModal(true);
      } else {
        toast.error('Failed to load PR details');
      }
    } catch (error) {
      console.error('Error fetching PR detail:', error);
      toast.error('Error loading PR details');
    }
  };

  const handleCreatePR = () => {
    setShowCreateModal(true);
    setCreateStep(1);
    setSelectedItemIds([]);
    setPRFormData({
      vendor_id: '',
      expected_delivery_date: '',
      remarks: '',
      payment_terms: ''
    });
    fetchAvailableItems();
  };

  const handleItemToggle = (itemId) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === availableItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(availableItems.map(item => item.id));
    }
  };

  const handleNextStep = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Please select at least one item');
      return;
    }
    setCreateStep(2);
  };

  const handleSubmitPR = async () => {
    if (!prFormData.vendor_id) {
      toast.error('Please select a vendor');
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimation_item_ids: selectedItemIds,
          ...prFormData
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Purchase Request ${data.purchase_request.pr_number} created successfully`);
        setShowCreateModal(false);
        fetchPurchaseRequests();
      } else {
        toast.error(data.error || 'Failed to create purchase request');
      }
    } catch (error) {
      console.error('Error creating PR:', error);
      toast.error('Error creating purchase request');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePR = async (prId, prNumber) => {
    if (!confirm(`Are you sure you want to cancel PR ${prNumber}? This will revert all items to Queued status.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/${prId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Purchase request cancelled successfully');
        fetchPurchaseRequests();
        setShowDetailModal(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to cancel purchase request');
      }
    } catch (error) {
      console.error('Error deleting PR:', error);
      toast.error('Error cancelling purchase request');
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

  const selectedItems = availableItems.filter(item => selectedItemIds.includes(item.id));
  const totalAmount = selectedItems.reduce((sum, item) => sum + parseFloat(item.item_total || 0), 0);

  const canCreatePR = session?.user?.role === USER_ROLE.ESTIMATOR || session?.user?.role === USER_ROLE.ADMIN;
  const canDeletePR = session?.user?.role === USER_ROLE.ADMIN;

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
              <Button onClick={handleCreatePR} className="gap-2">
                <Plus className="h-4 w-4" />
                Create PR
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* PR List */}
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
              <p className="text-muted-foreground">No purchase requests yet</p>
              {canCreatePR && (
                <Button onClick={handleCreatePR} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create First PR
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {purchaseRequests.map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => fetchPRDetail(pr.id)}
                >
                  <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="font-medium">{pr.pr_number}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(pr.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pr.vendor_name || 'No Vendor'}</p>
                      <p className="text-sm text-muted-foreground">{pr.items_count} items</p>
                    </div>
                    <div>
                      {getStatusBadge(pr.status)}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(pr.final_amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {pr.expected_delivery_date ? formatDate(pr.expected_delivery_date) : 'No date'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => {
                        e.stopPropagation();
                        fetchPRDetail(pr.id);
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create PR Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Create Purchase Request - Step {createStep} of 2
            </DialogTitle>
            <DialogDescription>
              {createStep === 1 ? 'Select estimation items for this purchase request' : 'Enter purchase request details'}
            </DialogDescription>
          </DialogHeader>

          {createStep === 1 ? (
            <div className="space-y-4">
              {availableItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No items available with "Queued" status</p>
                  <p className="text-sm mt-2">All estimation items are either already in purchase requests or have different status</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Checkbox
                      checked={selectedItemIds.length === availableItems.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label className="cursor-pointer">
                      Select All ({availableItems.length} items)
                    </Label>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-3 border rounded hover:bg-accent">
                        <Checkbox
                          checked={selectedItemIds.includes(item.id)}
                          onCheckedChange={() => handleItemToggle(item.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.category} • {item.room_name} • {item.quantity} {item.unit} @ {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(item.item_total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Selected: {selectedItemIds.length} items</p>
                      <p className="font-medium">Total: {formatCurrency(totalAmount)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Vendor *</Label>
                <Select value={prFormData.vendor_id} onValueChange={(value) => setPRFormData({...prFormData, vendor_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id.toString()}>
                        {vendor.name} - {vendor.vendor_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={prFormData.expected_delivery_date}
                  onChange={(e) => setPRFormData({...prFormData, expected_delivery_date: e.target.value})}
                />
              </div>

              <div>
                <Label>Payment Terms</Label>
                <Input
                  placeholder="e.g., 30 days credit"
                  value={prFormData.payment_terms}
                  onChange={(e) => setPRFormData({...prFormData, payment_terms: e.target.value})}
                />
              </div>

              <div>
                <Label>Remarks</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={prFormData.remarks}
                  onChange={(e) => setPRFormData({...prFormData, remarks: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="bg-accent p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Items:</span>
                  <span className="text-right">{selectedItemIds.length}</span>
                  <span>Total Amount:</span>
                  <span className="text-right font-medium">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {createStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleNextStep} disabled={selectedItemIds.length === 0}>
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateStep(1)}>
                  Back
                </Button>
                <Button onClick={handleSubmitPR} disabled={isCreating || !prFormData.vendor_id}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create PR'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PR Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {prDetail && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle>{prDetail.purchase_request.pr_number}</DialogTitle>
                    <DialogDescription>
                      Created by {prDetail.purchase_request.created_by_name} on {formatDate(prDetail.purchase_request.created_at)}
                    </DialogDescription>
                  </div>
                  <div>
                    {getStatusBadge(prDetail.purchase_request.status)}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* PR Details */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-accent rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium">{prDetail.purchase_request.vendor_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Delivery</p>
                    <p className="font-medium">
                      {prDetail.purchase_request.expected_delivery_date 
                        ? formatDate(prDetail.purchase_request.expected_delivery_date)
                        : 'Not set'}
                    </p>
                  </div>
                  {prDetail.purchase_request.payment_terms && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Payment Terms</p>
                      <p>{prDetail.purchase_request.payment_terms}</p>
                    </div>
                  )}
                  {prDetail.purchase_request.remarks && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Remarks</p>
                      <p>{prDetail.purchase_request.remarks}</p>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-medium mb-2">Items ({prDetail.items.length})</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2 text-sm">Room</th>
                          <th className="text-left p-2 text-sm">Item</th>
                          <th className="text-right p-2 text-sm">Qty</th>
                          <th className="text-right p-2 text-sm">Unit Price</th>
                          <th className="text-right p-2 text-sm">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prDetail.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2 text-sm">{item.room_name}</td>
                            <td className="p-2 text-sm">{item.item_name}</td>
                            <td className="p-2 text-sm text-right">{item.quantity} {item.unit}</td>
                            <td className="p-2 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="p-2 text-sm text-right font-medium">{formatCurrency(item.item_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-medium">
                        <tr>
                          <td colSpan="4" className="p-2 text-right">Total:</td>
                          <td className="p-2 text-right">{formatCurrency(prDetail.purchase_request.final_amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              <DialogFooter>
                {canDeletePR && prDetail.purchase_request.status !== PURCHASE_REQUEST_STATUS.CANCELLED && (
                  <Button
                    variant="destructive"
                    onClick={() => handleDeletePR(prDetail.purchase_request.id, prDetail.purchase_request.pr_number)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancel PR
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
