"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ArrowLeft, Edit, Save, X, Upload, FileText } from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id;

  const [customer, setCustomer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    kyc_type: 'none',
    business_type: 'B2C',
    bank_details: {
      account_number: '',
      ifsc_code: '',
      bank_name: '',
      branch_name: ''
    }
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchCustomerData();
    }
  }, [status, router, customerId]);

  const fetchCustomerData = async () => {
    try {
      const [customerRes, docsRes] = await Promise.all([
        fetch(`/api/customers/${customerId}`),
        fetch(`/api/documents/customer/${customerId}`)
      ]);

      if (customerRes.ok) {
        const data = await customerRes.json();
        setCustomer(data.customer);
        setFormData({
          name: data.customer.name || '',
          contact_person: data.customer.contact_person || '',
          phone: data.customer.phone || '',
          email: data.customer.email || '',
          address: data.customer.address || '',
          gst_number: data.customer.gst_number || '',
          kyc_type: data.customer.kyc_type || 'none',
          business_type: data.customer.business_type || 'B2C',
          bank_details: data.customer.bank_details || {
            account_number: '',
            ifsc_code: '',
            bank_name: '',
            branch_name: ''
          }
        });
      }

      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success('Customer updated successfully');
        setEditing(false);
        fetchCustomerData();
      } else {
        toast.error('Failed to update customer');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('An error occurred');
    }
  };

  const handleFileUpload = async (docType, file) => {
    if (!file) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Upload file
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        toast.error('Failed to upload file');
        return;
      }

      const uploadData = await uploadRes.json();

      // Create document record
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          related_entity: 'customer',
          related_id: customerId,
          document_type: docType,
          document_url: uploadData.url,
          file_name: uploadData.fileName,
          file_size: uploadData.size,
          mime_type: uploadData.type
        })
      });

      toast.success('Document uploaded successfully');
      fetchCustomerData();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !customer) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Toaster richColors position="top-right" />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/customers">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Customers
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
              <p className="text-muted-foreground mt-1">Customer Details & KYC</p>
            </div>
          </div>
          {!editing ? (
            <Button onClick={() => setEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setEditing(false);
                fetchCustomerData();
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleUpdate}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input
                      value={formData.gst_number}
                      onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.business_type}
                      onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                    >
                      <option value="B2C">B2C (Business to Consumer)</option>
                      <option value="B2B">B2B (Business to Business)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </form>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Contact Person</p>
                  <p className="font-medium">{customer.contact_person || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{customer.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GST Number</p>
                  <p className="font-medium">{customer.gst_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Business Type</p>
                  <Badge variant="outline">{customer.business_type || 'Not Set'}</Badge>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{customer.address || 'N/A'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={formData.bank_details?.account_number || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      bank_details: { ...formData.bank_details, account_number: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input
                    value={formData.bank_details?.ifsc_code || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      bank_details: { ...formData.bank_details, ifsc_code: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={formData.bank_details?.bank_name || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      bank_details: { ...formData.bank_details, bank_name: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch Name</Label>
                  <Input
                    value={formData.bank_details?.branch_name || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      bank_details: { ...formData.bank_details, branch_name: e.target.value }
                    })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Account Number</p>
                  <p className="font-medium">{customer.bank_details?.account_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IFSC Code</p>
                  <p className="font-medium">{customer.bank_details?.ifsc_code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Name</p>
                  <p className="font-medium">{customer.bank_details?.bank_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Branch Name</p>
                  <p className="font-medium">{customer.bank_details?.branch_name || 'N/A'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KYC Documents */}
        <Card>
          <CardHeader>
            <CardTitle>KYC Documents</CardTitle>
            <CardDescription>Upload customer KYC documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Aadhar Card */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Aadhar Card</h3>
                  {documents.find(d => d.document_type === 'kyc_aadhar') ? (
                    <div className="space-y-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">✓ Uploaded</Badge>
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href={documents.find(d => d.document_type === 'kyc_aadhar').document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id="aadhar"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleFileUpload('kyc_aadhar', e.target.files[0])}
                        disabled={uploadingDoc}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById('aadhar').click()}
                        disabled={uploadingDoc}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  )}
                </div>

                {/* PAN Card */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">PAN Card</h3>
                  {documents.find(d => d.document_type === 'kyc_pan') ? (
                    <div className="space-y-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">✓ Uploaded</Badge>
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href={documents.find(d => d.document_type === 'kyc_pan').document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id="pan"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleFileUpload('kyc_pan', e.target.files[0])}
                        disabled={uploadingDoc}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById('pan').click()}
                        disabled={uploadingDoc}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  )}
                </div>

                {/* Blank Cheque */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Blank Cheque</h3>
                  {documents.find(d => d.document_type === 'kyc_cheque') ? (
                    <div className="space-y-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">✓ Uploaded</Badge>
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href={documents.find(d => d.document_type === 'kyc_cheque').document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id="cheque"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleFileUpload('kyc_cheque', e.target.files[0])}
                        disabled={uploadingDoc}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById('cheque').click()}
                        disabled={uploadingDoc}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
