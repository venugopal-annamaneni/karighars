"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export default function OverInvoicedAlert({ data, onClose }) {
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    credit_note_number: `CN-${data.project_id}-${Date.now()}`,
    amount: Math.abs(data.over_invoiced_amount),
    remarks: 'Credit note for over-invoiced amount'
  });

  const handleCreateCreditNote = async () => {
    try {
      setCreating(true);

      const response = await fetch(`/api/projects/${data.project_id}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: data.project_id,
          estimation_id: data.estimation_id,
          invoice_number: formData.credit_note_number,
          invoice_amount: -Math.abs(formData.amount), // NEGATIVE for credit note
          invoice_date: new Date().toISOString(),
          invoice_document_url: '', // To be uploaded later
          remarks: formData.remarks
        })
      });

      if (response.ok) {
        toast.success(`Credit note created successfully! Please upload the credit note document in the Invoices tab.`);
        onClose();
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
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
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
            <li>Finance creates credit note for {formatCurrency(data.over_invoiced_amount)}</li>
            <li>Finance uploads credit note document in Invoices tab</li>
            <li>Admin approves credit note</li>
            <li>Invoiced amount reduces accordingly</li>
          </ol>
        </div>

        {!showForm && (
          <Button 
            onClick={() => setShowForm(true)} 
            className="w-full"
            variant="default"
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
              ⚠️ After creation, you must upload the credit note document in the Invoices tab before it can be approved.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
