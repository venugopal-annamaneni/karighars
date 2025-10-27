"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, Edit, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectData } from '@/app/context/ProjectDataContext';
import { USER_ROLE } from '@/app/constants';

export default function BaseRatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const [activeRate, setActiveRate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRate, setSelectedRate] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [formData, setFormData] = useState({
    service_charge_percentage: '',
    max_service_charge_discount_percentage: '',
    design_charge_percentage: '',
    max_design_charge_discount_percentage: '',
    shopping_charge_percentage: '',
    max_shopping_charge_discount_percentage: '',
    gst_percentage: '',
    comments: ''
  });

  const [rejectComments, setRejectComments] = useState('');

  const { project } = useProjectData();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (projectId) {
      fetchBaseRates();
    }
  }, [projectId]);

  const fetchBaseRates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/app/api/projects/${projectId}/base-rates`);
      if (!res.ok) throw new Error('Failed to fetch base rates');
      
      const data = await res.json();
      setActiveRate(data.activeRate);
      setHistory(data.history);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load base rates');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = () => {
    if (activeRate) {
      setFormData({
        service_charge_percentage: activeRate.service_charge_percentage,
        max_service_charge_discount_percentage: activeRate.max_service_charge_discount_percentage,
        design_charge_percentage: activeRate.design_charge_percentage,
        max_design_charge_discount_percentage: activeRate.max_design_charge_discount_percentage,
        shopping_charge_percentage: activeRate.shopping_charge_percentage,
        max_shopping_charge_discount_percentage: activeRate.max_shopping_charge_discount_percentage,
        gst_percentage: activeRate.gst_percentage,
        comments: ''
      });
    }
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async () => {
    try {
      setProcessing(true);

      // Validation
      if (!formData.service_charge_percentage || !formData.design_charge_percentage || 
          !formData.shopping_charge_percentage || !formData.gst_percentage) {
        toast.error('All rate percentages are required');
        return;
      }

      const res = await fetch(`/app/api/projects/${projectId}/base-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit request');
      }

      toast.success('Base rate change request submitted successfully');
      setShowRequestModal(false);
      fetchBaseRates();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = (rate) => {
    setSelectedRate(rate);
    setShowApproveModal(true);
  };

  const confirmApprove = async () => {
    try {
      setProcessing(true);

      const res = await fetch(`/app/api/projects/${projectId}/base-rates/${selectedRate.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_charge_percentage: selectedRate.service_charge_percentage,
          max_service_charge_discount_percentage: selectedRate.max_service_charge_discount_percentage,
          design_charge_percentage: selectedRate.design_charge_percentage,
          max_design_charge_discount_percentage: selectedRate.max_design_charge_discount_percentage,
          shopping_charge_percentage: selectedRate.shopping_charge_percentage,
          max_shopping_charge_discount_percentage: selectedRate.max_shopping_charge_discount_percentage,
          gst_percentage: selectedRate.gst_percentage
        })
      });

      if (!res.ok) {
        const error = await res.json();
        if (res.status === 409) {
          toast.error('Base rate values have been modified. Please refresh the page.');
        } else {
          throw new Error(error.error || 'Failed to approve');
        }
        return;
      }

      toast.success('Base rate change approved successfully');
      setShowApproveModal(false);
      setSelectedRate(null);
      fetchBaseRates();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (rate) => {
    setSelectedRate(rate);
    setRejectComments('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    try {
      if (!rejectComments.trim()) {
        toast.error('Rejection reason is required');
        return;
      }

      setProcessing(true);

      const res = await fetch(`/app/api/projects/${projectId}/base-rates/${selectedRate.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: rejectComments })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject');
      }

      toast.success('Base rate change rejected');
      setShowRejectModal(false);
      setSelectedRate(null);
      setRejectComments('');
      fetchBaseRates();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'requested':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Approval</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isAdmin = session?.user?.role === USER_ROLE.ADMIN;
  const pendingRequest = history.find(r => r.status === 'requested');

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading base rates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Active Rate */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Current Active Base Rates</CardTitle>
              <CardDescription>
                These rates are currently being used for estimations
              </CardDescription>
            </div>
            {!pendingRequest && (
              <Button onClick={handleRequestChange}>
                <Edit className="h-4 w-4 mr-2" />
                Request Change
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeRate ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Service Charge</p>
                  <p className="text-2xl font-bold text-blue-600">{activeRate.service_charge_percentage}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Max Discount: {activeRate.max_service_charge_discount_percentage}%</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Design Charge (Woodwork)</p>
                  <p className="text-2xl font-bold text-purple-600">{activeRate.design_charge_percentage}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Max Discount: {activeRate.max_design_charge_discount_percentage}%</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Shopping Charge</p>
                  <p className="text-2xl font-bold text-green-600">{activeRate.shopping_charge_percentage}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Max Discount: {activeRate.max_shopping_charge_discount_percentage}%</p>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-slate-50">
                <p className="text-sm text-muted-foreground">GST</p>
                <p className="text-2xl font-bold">{activeRate.gst_percentage}%</p>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div>
                  <strong>Status:</strong> {getStatusBadge(activeRate.status)}
                </div>
                <div>
                  <strong>Active:</strong> <Badge variant="outline" className="bg-green-50">Yes</Badge>
                </div>
                <div>
                  <strong>Created:</strong> {formatDate(activeRate.created_at)}
                </div>
                {activeRate.created_by_name && (
                  <div>
                    <strong>By:</strong> {activeRate.created_by_name}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No active base rate found</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Request Alert */}
      {pendingRequest && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-1" />
              <div className="flex-1">
                <CardTitle className="text-amber-900">Pending Approval</CardTitle>
                <CardDescription className="text-amber-700">
                  A base rate change request is awaiting admin approval
                </CardDescription>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(pendingRequest)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(pendingRequest)}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Service Charge</p>
                <p className="font-semibold">{pendingRequest.service_charge_percentage}% (max disc: {pendingRequest.max_service_charge_discount_percentage}%)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Design Charge</p>
                <p className="font-semibold">{pendingRequest.design_charge_percentage}% (max disc: {pendingRequest.max_design_charge_discount_percentage}%)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Shopping Charge</p>
                <p className="font-semibold">{pendingRequest.shopping_charge_percentage}% (max disc: {pendingRequest.max_shopping_charge_discount_percentage}%)</p>
              </div>
              <div>
                <p className="text-muted-foreground">GST</p>
                <p className="font-semibold">{pendingRequest.gst_percentage}%</p>
              </div>
            </div>
            {pendingRequest.comments && (
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-xs text-muted-foreground">Justification:</p>
                <p className="text-sm">{pendingRequest.comments}</p>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Requested by {pendingRequest.created_by_name} on {formatDate(pendingRequest.created_at)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.filter(r => r.status !== 'requested').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Previous base rate changes and requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.filter(r => r.status !== 'requested').map((rate) => (
                <div key={rate.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      {getStatusBadge(rate.status)}
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      {formatDate(rate.created_at)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Service</p>
                      <p className="font-medium">{rate.service_charge_percentage}% (max: {rate.max_service_charge_discount_percentage}%)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Design</p>
                      <p className="font-medium">{rate.design_charge_percentage}% (max: {rate.max_design_charge_discount_percentage}%)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Shopping</p>
                      <p className="font-medium">{rate.shopping_charge_percentage}% (max: {rate.max_shopping_charge_discount_percentage}%)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">GST</p>
                      <p className="font-medium">{rate.gst_percentage}%</p>
                    </div>
                  </div>
                  {rate.comments && (
                    <div className="mt-3 p-2 bg-slate-50 rounded text-sm">
                      <p className="text-xs text-muted-foreground">
                        {rate.status === 'rejected' ? 'Rejection Reason' : 'Comments'}:
                      </p>
                      <p>{rate.comments}</p>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {rate.status === 'approved' && rate.approved_by_name && (
                      <span>Approved by {rate.approved_by_name} on {formatDate(rate.approved_at)}</span>
                    )}
                    {rate.status === 'rejected' && rate.rejected_by_name && (
                      <span>Rejected by {rate.rejected_by_name} on {formatDate(rate.rejected_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Change Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Base Rate Change</DialogTitle>
            <DialogDescription>
              {pendingRequest 
                ? 'Update your pending request with new values' 
                : 'Submit a new base rate change request for admin approval'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Service Charge (%)<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.service_charge_percentage}
                  onChange={(e) => setFormData({...formData, service_charge_percentage: e.target.value})}
                />
              </div>
              <div>
                <Label>Max Service Discount (%)<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_service_charge_discount_percentage}
                  onChange={(e) => setFormData({...formData, max_service_charge_discount_percentage: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Design Charge (%)<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.design_charge_percentage}
                  onChange={(e) => setFormData({...formData, design_charge_percentage: e.target.value})}
                />
              </div>
              <div>
                <Label>Max Design Discount (%)<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_design_charge_discount_percentage}
                  onChange={(e) => setFormData({...formData, max_design_charge_discount_percentage: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shopping Charge (%)<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.shopping_charge_percentage}
                  onChange={(e) => setFormData({...formData, shopping_charge_percentage: e.target.value})}
                />
              </div>
              <div>
                <Label>Max Shopping Discount (%)<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_shopping_charge_discount_percentage}
                  onChange={(e) => setFormData({...formData, max_shopping_charge_discount_percentage: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>GST (%)<span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={formData.gst_percentage}
                onChange={(e) => setFormData({...formData, gst_percentage: e.target.value})}
              />
            </div>
            <div>
              <Label>Justification / Comments</Label>
              <Textarea
                value={formData.comments}
                onChange={(e) => setFormData({...formData, comments: e.target.value})}
                placeholder="Explain why these rate changes are needed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={processing}>
              {processing ? 'Submitting...' : pendingRequest ? 'Update Request' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Base Rate Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this base rate change? This will become the active rate for all future estimations.
            </DialogDescription>
          </DialogHeader>
          {selectedRate && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong>Service Charge:</strong> {selectedRate.service_charge_percentage}%
                </div>
                <div>
                  <strong>Design Charge:</strong> {selectedRate.design_charge_percentage}%
                </div>
                <div>
                  <strong>Shopping Charge:</strong> {selectedRate.shopping_charge_percentage}%
                </div>
                <div>
                  <strong>GST:</strong> {selectedRate.gst_percentage}%
                </div>
              </div>
              {selectedRate.comments && (
                <div className="p-2 bg-slate-50 rounded">
                  <strong>Justification:</strong>
                  <p className="mt-1">{selectedRate.comments}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={processing}>
              {processing ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Base Rate Change</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Rejection Reason<span className="text-red-500">*</span></Label>
            <Textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              placeholder="Explain why this request is being rejected..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={processing}>
              {processing ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
