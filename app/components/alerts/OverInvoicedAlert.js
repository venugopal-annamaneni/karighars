"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { INVOICE_RECORD_TYPE, USER_ROLE } from '@/app/constants';


export default function OverInvoicedAlert({ data, userRole, onClose }) {
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    document_number: '',
    amount: '',
    document_date: new Date().toISOString().split('T')[0],
    document_url: '',
    remarks: '',
    record_type: INVOICE_RECORD_TYPE.INVOICE,
    credit_note_number: `CN-${data.project_id}-${Date.now()}`,
    amount: Math.abs(data.over_invoiced_amount),
    remarks: ''
  });
  const [uploading, setUploading] = useState(false);

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

  const handleCreateCreditNote = async () => {
    debugger;

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!formData.document_url) {
      toast.error('Please upload credit note document');
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(`/api/projects/${data.project_id}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: data.project_id,
          document_number: formData.credit_note_number,
          record_type: INVOICE_RECORD_TYPE.CREDIT_NOTE,
          amount: -Math.abs(formData.amount), // NEGATIVE for credit note
          document_date: new Date().toISOString(),
          document_url: formData.document_url,
          remarks: formData.remarks
        })
      });

      if (response.ok) {
        toast.success(`Credit note created successfully!`);
        onClose();
        data.fetchProjectData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create credit note');
      }
    } catch (error) {
      console.error('Error creating credit note:', error);
      toast.error('Error creating credit note');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="border-orange-500 bg-orange-50 shadow-lg">
      <CardHeader className="relative">

        <CardTitle className="text-orange-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Over-Invoiced Project Detected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white p-4 rounded-lg border border-orange-200">
          <p className="text-sm mb-3">
            The total invoiced amount exceeds the project's final estimated value.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Final Project Value:</span>
              <span className="font-semibold">{formatCurrency(data.final_value)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Invoiced Amount:</span>
              <span className="font-semibold">{formatCurrency(data.invoiced_amount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-bold text-orange-700">Over-Invoiced Amount:</span>
              <span className="font-bold text-orange-700">{formatCurrency(data.over_invoiced_amount)}</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="font-semibold mb-2 text-sm">What happens next?</p>
          <ol className="list-decimal ml-5 space-y-1 text-sm">
            <li>Finance team to create a credit note for {formatCurrency(data.over_invoiced_amount)}</li>
            <li>Invoiced amount reduces accordingly</li>
          </ol>
        </div>

        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full"
            variant="default"
            disabled={!(userRole === USER_ROLE.ADMIN || userRole === USER_ROLE.FINANCE)}
          >
            Create Credit Note
          </Button>
        )}

        {showForm && (
          <div className="bg-white p-4 rounded-lg border space-y-4">
            <div className="space-y-2">
              <Label>Credit Note Number</Label>
              <Input
                value={formData.credit_note_number}
                onChange={(e) => setFormData({ ...formData, credit_note_number: e.target.value })}
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

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                This will be stored as a negative amount to reduce invoiced total
              </p>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreateCreditNote}
                disabled={creating}
                className="flex-1"
              >
                {creating ? 'Creating...' : 'Create Credit Note'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={creating}
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ After creation, auto approved on credit note document in the Invoices tab.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
