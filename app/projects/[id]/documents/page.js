"use client";

import { useProjectData } from '@/app/context/ProjectDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROJECT_STAGES, USER_ROLE } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FileText,
  Plus
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ProjectDocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;


  const [documents, setDocuments] = useState([]);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    invoice_url: null,
    revenue_realized: ''
  });
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const { project, loading, fetchProjectData } = useProjectData();
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchProjectDocumentsData();
    }
  }, [status, router, projectId]);

  const fetchProjectDocumentsData = async () => {
    try {
      setDocsLoading(true);
      const [docsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/documents?group_type=project&group_id=${projectId}`),
      ]);
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching project documents:', error);
      toast.error('Failed to load project documents');
    } finally {
      setDocsLoading(false);
    }
  };

  const handleInvoiceUpload = async (file) => {
    if (!file) return;

    // Check if user is Finance role
    if (session.user.role !== 'finance' && session.user.role !== USER_ROLE.ADMIN) {
      toast.error('Only Finance team can upload invoices');
      return;
    }

    setUploadingInvoice(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setInvoiceData(prev => ({ ...prev, invoice_url: data.url }));
        toast.success('Invoice document uploaded successfully');
      } else {
        toast.error('Failed to upload invoice document');
      }
    } catch (error) {
      console.error('Error uploading invoice document:', error);
      toast.error('Invoice document upload failed');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_url: invoiceData.invoice_url,
          revenue_realized: invoiceData.revenue_realized
        })
      });

      if (res.ok) {
        // Create document record
        if (invoiceData.invoice_url) {
          await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              related_entity: 'project',
              related_id: projectId,
              document_type: 'project_invoice',
              document_url: invoiceData.invoice_url,
              file_name: 'Project Invoice',
              remarks: `Invoice for revenue realized: ₹${invoiceData.revenue_realized}`
            })
          });
        }

        toast.success('Invoice uploaded successfully');
        setShowInvoiceDialog(false);
        setInvoiceData({ invoice_url: null, revenue_realized: '' });
        //fetchProjectDocumentsData();
        fetchProjectData(); // This causes the entire page to re-render due to ProjectDataContext , no need to call fetchProjectDocumentsData()
      } else {
        toast.error('Failed to save invoice');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('An error occurred');
    }
  };

  if (status === 'loading' || loading || docsLoading) {
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

    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Project Documents</CardTitle>
            <CardDescription>View all documents related to this project</CardDescription>
          </div>
          {(session?.user?.role === 'finance' || session?.user?.role === USER_ROLE.ADMIN) && (
            <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Upload Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Project Invoice</DialogTitle>
                  <DialogDescription>
                    Upload invoice and record revenue realized
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_file">Invoice Document *</Label>
                    <Input
                      id="invoice_file"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleInvoiceUpload(e.target.files[0])}
                      disabled={uploadingInvoice}
                      required={!invoiceData.invoice_url}
                    />
                    {invoiceData.invoice_url && <p className="text-xs text-green-600">✓ Enter Revenue and [Upload Invoice] to finish uploading</p>}
                    {uploadingInvoice && <p className="text-xs text-blue-600">Uploading...</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue_realized">Revenue Realized (₹)</Label>
                    <Input
                      id="revenue_realized"
                      type="number"
                      step="0.01"
                      placeholder="Enter revenue amount"
                      value={invoiceData.revenue_realized}
                      onChange={(e) => setInvoiceData({ ...invoiceData, revenue_realized: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { 
                      setInvoiceData({ invoice_url: null, revenue_realized: '' }); 
                      setShowInvoiceDialog(false) 
                    }}>Cancel</Button>
                    <Button type="submit" disabled={uploadingInvoice || !invoiceData.invoice_url || !invoiceData.revenue_realized}>Upload Invoice</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                <div>
                  <p className="font-medium">{doc.file_name || 'Document'}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.document_type === 'payment_receipt' && 'Payment Receipt'}
                    {doc.document_type === 'project_invoice' && 'Project Invoice'}
                    {doc.document_type === 'credit_note' && 'Credit Note'}
                    {doc.related_entity === 'customer_payments' && (
                      <span className="text-xs font-bold text-muted-foreground mt-1 ml-1">
                        ({formatCurrency(doc.related_info.amount)})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded by {doc.uploaded_by_name || 'N/A'} on {formatDate(doc.created_at)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />
                    View
                  </a>
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}