"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { FileText, Check, X, Eye, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function InvoicesPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [invoices, setInvoices] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_document_url: '',
    remarks: ''
  });

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchInvoices();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

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
      setLoading(false);
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
        setFormData(prev => ({ ...prev, invoice_document_url: data.url }));
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

    if (!formData.invoice_amount || parseFloat(formData.invoice_amount) <= 0) {
      toast.error('Please enter a valid invoice amount');
      return;
    }

    if (!formData.invoice_document_url) {
      toast.error('Please upload invoice document');
      return;
    }

    // Validate invoice amount against available amount
    if (project) {
      const paymentsReceived = parseFloat(project.payments_received || 0);
      const invoicedAmount = parseFloat(project.invoiced_amount || 0);
      const availableToInvoice = paymentsReceived - invoicedAmount;
      const requestedAmount = parseFloat(formData.invoice_amount);

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
          invoice_number: '',
          invoice_amount: '',
          invoice_date: new Date().toISOString().split('T')[0],
          invoice_document_url: '',
          remarks: ''
        });
        fetchInvoices();
        fetchProject(); // Refresh project data
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

  const handleApprove = async () => {
    if (!selectedInvoice) return;

    try {
      setProcessing(true);
      const res = await fetch(`/api/projects/${projectId}/invoices/${selectedInvoice.id}/approve`, {
        method: 'POST'
      });

      if (res.ok) {
        toast.success('Invoice approved successfully');
        setShowApproveDialog(false);
        setSelectedInvoice(null);
        fetchInvoices();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to approve invoice');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error approving invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedInvoice || !cancellationReason.trim()) {
      toast.error('Please enter cancellation reason');
      return;
    }

    try {
      setProcessing(true);
      const res = await fetch(`/api/projects/${projectId}/invoices/${selectedInvoice.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason: cancellationReason })
      });

      if (res.ok) {
        toast.success('Invoice cancelled successfully');
        setShowCancelDialog(false);
        setSelectedInvoice(null);
        setCancellationReason('');
        fetchInvoices();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to cancel invoice');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cancelling invoice');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>;
    if (status === 'approved') return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Approved</Badge>;
    if (status === 'cancelled') return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Cancelled</Badge>;
    return <Badge>{status}</Badge>;
  };

  const canUpload = session?.user?.role === 'finance' || session?.user?.role === 'admin';
  const canApprove = session?.user?.role === 'admin';
  const canCancel = session?.user?.role === 'admin' || session?.user?.role === 'finance';

  // Calculate available amount to invoice
  const paymentsReceived = parseFloat(project?.payments_received || 0);
  const invoicedAmount = parseFloat(project?.invoiced_amount || 0);
  const availableToInvoice = paymentsReceived - invoicedAmount;

  if (loading) {
    return <div className="p-6">Loading invoices...</div>;
  }

  return (
    <div className="p-6 space-y-6">
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
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.invoice_amount}
                    onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
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
                  {formData.invoice_document_url && (
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
                  const isCreditNote = parseFloat(invoice.invoice_amount) < 0;
                  return (
                  <TableRow key={invoice.id} className={isCreditNote ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number || '-'}
                      {isCreditNote && (
                        <Badge variant="outline" className="ml-2 bg-red-100 text-red-700 border-red-300 text-xs">
                          CREDIT NOTE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell className={`font-semibold ${isCreditNote ? 'text-red-600' : ''}`}>
                      {formatCurrency(invoice.invoice_amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>{invoice.uploaded_by_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {invoice.invoice_document_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invoice.invoice_document_url, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {invoice.status === 'pending' && canApprove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowApproveDialog(true);
                            }}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {invoice.status === 'pending' && canCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowCancelDialog(true);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}

                        {invoice.status === 'approved' && (
                          <span className="text-xs text-green-600">
                            ✓ by {invoice.approved_by_name}
                          </span>
                        )}

                        {invoice.status === 'cancelled' && (
                          <span className="text-xs text-red-600">
                            ✗ by {invoice.cancelled_by_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this invoice?
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-2 py-4">
              <p><strong>Invoice:</strong> {selectedInvoice.invoice_number || 'N/A'}</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.invoice_amount)}</p>
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

      {/* Cancel Dialog */}
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
              <p><strong>Invoice:</strong> {selectedInvoice.invoice_number || 'N/A'}</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.invoice_amount)}</p>
              
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
      </Dialog>
    </div>
  );
}
