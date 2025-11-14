"use client";

import { INVOICE_RECORD_TYPE, INVOICE_STATUS } from '@/app/constants';
import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, Upload } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function InvoicesPage() {
  const { data: session } = useSession();
  const params = useParams();
  const projectId = params.id;

  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    document_number: '',
    amount: '',
    document_date: new Date().toISOString().split('T')[0],
    document_url: '',
    remarks: '',
    record_type: INVOICE_RECORD_TYPE.INVOICE
  });

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { fetchProjectData, project, loading } = useProjectData();

  useEffect(() => {
    fetchInvoices();
  }, [projectId]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ 
          ...prev, 
          document_url: data.url,
          file_name: data.fileName,
          file_size: data.size,
          mime_type: data.type
        }));
        toast.success('Document uploaded successfully');
      } else {
        toast.error('Failed to upload document');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error uploading document');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid invoice amount');
      return;
    }

    if (!formData.document_url) {
      toast.error('Please upload invoice document');
      return;
    }

    // Validate invoice amount against available amount
    if (project) {
      const paymentsReceived = parseFloat(project.payments_received || 0);
      const invoicedAmount = parseFloat(project.invoiced_amount || 0);
      const availableToInvoice = paymentsReceived - invoicedAmount;
      const requestedAmount = parseFloat(formData.amount);

      if (requestedAmount > availableToInvoice) {
        toast.error(
          `Invoice amount ₹${requestedAmount.toLocaleString('en-IN')} cannot exceed available amount ₹${availableToInvoice.toLocaleString('en-IN')}. ` +
          `Received: ₹${paymentsReceived.toLocaleString('en-IN')}, Already Invoiced: ₹${invoicedAmount.toLocaleString('en-IN')}`
        );
        return;
      }
    }

    try {
      setUploading(true);
      const res = await fetch(`/api/projects/${projectId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success('Invoice uploaded successfully');
        setFormData({
          document_number: '',
          amount: '',
          document_date: new Date().toISOString().split('T')[0],
          document_url: '',
          remarks: '',
          record_type: INVOICE_RECORD_TYPE.INVOICE
        });
        //fetchInvoices();
        fetchProjectData(); // Refresh project data renders the page again, triggers fetchInvoices
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to upload invoice');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error uploading invoice');
    } finally {
      setUploading(false);
    }
  };

  // const handleApprove = async () => {
  //   if (!selectedInvoice) return;

  //   try {
  //     setProcessing(true);
  //     const res = await fetch(`/api/projects/${projectId}/invoices/${selectedInvoice.id}/approve`, {
  //       method: 'POST'
  //     });

  //     if (res.ok) {
  //       toast.success('Invoice approved successfully');
  //       setShowApproveDialog(false);
  //       setSelectedInvoice(null);
  //       fetchInvoices();
  //     } else {
  //       const error = await res.json();
  //       toast.error(error.error || 'Failed to approve invoice');
  //     }
  //   } catch (error) {
  //     console.error('Error:', error);
  //     toast.error('Error approving invoice');
  //   } finally {
  //     setProcessing(false);
  //   }
  // };

  // const handleCancel = async () => {
  //   if (!selectedInvoice || !cancellationReason.trim()) {
  //     toast.error('Please enter cancellation reason');
  //     return;
  //   }

  //   try {
  //     setProcessing(true);
  //     const res = await fetch(`/api/projects/${projectId}/invoices/${selectedInvoice.id}/cancel`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ cancellation_reason: cancellationReason })
  //     });

  //     if (res.ok) {
  //       toast.success('Invoice cancelled successfully');
  //       setShowCancelDialog(false);
  //       setSelectedInvoice(null);
  //       setCancellationReason('');
  //       fetchInvoices();
  //     } else {
  //       const error = await res.json();
  //       toast.error(error.error || 'Failed to cancel invoice');
  //     }
  //   } catch (error) {
  //     console.error('Error:', error);
  //     toast.error('Error cancelling invoice');
  //   } finally {
  //     setProcessing(false);
  //   }
  // };


  const getStatusBadge = (status) => {
    if (status === INVOICE_STATUS.PENDING) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>;
    if (status === INVOICE_STATUS.APPROVED) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Approved</Badge>;
    if (status === INVOICE_STATUS.CANCELLED) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Cancelled</Badge>;
    return <Badge>{status}</Badge>;
  };

  const canUpload = session?.user?.role === 'finance' || session?.user?.role === 'admin';
  const canApprove = session?.user?.role === 'admin';
  const canCancel = session?.user?.role === 'admin' || session?.user?.role === 'finance';

  // Calculate available amount to invoice
  const paymentsReceived = parseFloat(project?.payments_received || 0);
  const invoicedAmount = parseFloat(project?.invoiced_amount || 0);
  const availableToInvoice = paymentsReceived - invoicedAmount;

  if (status === 'loading' || loading || invoicesLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-start justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !project) return null;

  return (
    <div className="space-y-6">
      {/* Upload Invoice Form */}
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Upload New Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Available Amount Display */}
            {project && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Available to Invoice:</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Received: {formatCurrency(paymentsReceived)} - Already Invoiced: {formatCurrency(invoicedAmount)}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {formatCurrency(availableToInvoice)}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input
                    placeholder="INV-001"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Document *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  {formData.document_url && (
                    <p className="text-xs text-green-600">✓ Document uploaded</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={2}
                />
              </div>

              <Button type="submit" disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Invoice'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices uploaded yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const isCreditNote = invoice.record_type === INVOICE_RECORD_TYPE.CREDIT_NOTE;
                  return (
                    <TableRow key={invoice.id} className={isCreditNote ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">
                        {invoice.document_number || '-'}
                        {isCreditNote && (
                          <Badge variant="outline" className="ml-2 bg-red-100 text-red-700 border-red-300 text-xs">
                            CREDIT NOTE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(invoice.document_date)}</TableCell>
                      <TableCell className={`font-bold ${isCreditNote ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>{invoice.created_by_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {invoice.document_url && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => window.open(invoice.document_url, '_blank')}
                            >
                              View
                            </Button>
                          )}
                          {/* {invoice.status === 'pending' && canApprove && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-white"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowApproveDialog(true);
                              }}
                            >
                              Approve
                            </Button>
                          )}

                          {invoice.status === 'pending' && canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-700"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowCancelDialog(true);
                              }}
                            >
                              Cancel
                            </Button>
                          )} */}

                          {/* {invoice.status === 'approved' && (
                            <span className="text-xs text-green-600">
                              ✓ by {invoice.approved_by_name}
                            </span>
                          )}

                          {invoice.status === 'cancelled' && (
                            <span className="text-xs text-red-600">
                              ✗ by {invoice.cancelled_by_name}
                            </span>
                          )} */}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      {/* <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this invoice?
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-2 py-4">
              <p><strong>Invoice:</strong> {selectedinvoice.document_number || 'N/A'}</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.amount)}</p>
              <p className="text-sm text-muted-foreground">
                This will increase the project's realized revenue.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? 'Approving...' : 'Approve Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this invoice.
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <p><strong>Invoice:</strong> {selectedinvoice.document_number || 'N/A'}</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.amount)}</p>

              <div className="space-y-2">
                <Label>Cancellation Reason *</Label>
                <Textarea
                  placeholder="Enter reason for cancellation..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCancelDialog(false);
              setCancellationReason('');
            }}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={processing || !cancellationReason.trim()}
            >
              {processing ? 'Cancelling...' : 'Cancel Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
