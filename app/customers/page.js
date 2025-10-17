"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Plus, Search, Phone, Mail, MapPin } from 'lucide-react';

export default function CustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: ''
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchCustomers();
    }
  }, [status, router]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setFilteredCustomers(data.customers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (type, file) => {
    if (!file) return;
    
    setUploadingKyc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setKycFiles(prev => ({ ...prev, [type]: data.url }));
        toast.success(`${type.toUpperCase()} uploaded successfully`);
      } else {
        toast.error(`Failed to upload ${type}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Upload failed');
    } finally {
      setUploadingKyc(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare payload with KYC documents
      const payload = {
        ...formData,
        kyc_documents: kycFiles
      };

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Upload KYC documents if customer created
        if (data.customer) {
          const uploadPromises = [];
          
          if (kycFiles.aadhar) {
            uploadPromises.push(
              fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  related_entity: 'customer',
                  related_id: data.customer.id,
                  document_type: 'kyc_aadhar',
                  document_url: kycFiles.aadhar,
                  file_name: 'Aadhar Card',
                }),
              })
            );
          }
          
          if (kycFiles.pan) {
            uploadPromises.push(
              fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  related_entity: 'customer',
                  related_id: data.customer.id,
                  document_type: 'kyc_pan',
                  document_url: kycFiles.pan,
                  file_name: 'PAN Card',
                }),
              })
            );
          }
          
          if (kycFiles.cheque) {
            uploadPromises.push(
              fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  related_entity: 'customer',
                  related_id: data.customer.id,
                  document_type: 'kyc_cheque',
                  document_url: kycFiles.cheque,
                  file_name: 'Blank Cheque',
                }),
              })
            );
          }
          
          await Promise.all(uploadPromises);
        }
        
        toast.success('Customer created successfully');
        setShowDialog(false);
        setFormData({
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
        setKycFiles({ aadhar: null, pan: null, cheque: null });
        fetchCustomers();
      } else {
        toast.error('Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('An error occurred');
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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Toaster richColors position="top-right" />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground mt-1">
              Manage your customer database
            </p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Create a new customer record
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Person</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST Number</Label>
                    <Input
                      id="gst"
                      value={formData.gst_number}
                      onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_type">Business Type *</Label>
                    <select
                      id="business_type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formData.business_type}
                      onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                      required
                    >
                      <option value="B2C">B2C (Business to Consumer)</option>
                      <option value="B2B">B2B (Business to Business)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-3">KYC Documents (Optional)</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="aadhar">Aadhar Card</Label>
                      <Input
                        id="aadhar"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange('aadhar', e.target.files[0])}
                        disabled={uploadingKyc}
                      />
                      {kycFiles.aadhar && <p className="text-xs text-green-600">✓ Uploaded</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pan">PAN Card</Label>
                      <Input
                        id="pan"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange('pan', e.target.files[0])}
                        disabled={uploadingKyc}
                      />
                      {kycFiles.pan && <p className="text-xs text-green-600">✓ Uploaded</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cheque">Blank Cheque</Label>
                      <Input
                        id="cheque"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange('cheque', e.target.files[0])}
                        disabled={uploadingKyc}
                      />
                      {kycFiles.cheque && <p className="text-xs text-green-600">✓ Uploaded</p>}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-3">Bank Details (Optional)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="account_number">Account Number</Label>
                      <Input
                        id="account_number"
                        value={formData.bank_details.account_number}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          bank_details: { ...formData.bank_details, account_number: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc_code">IFSC Code</Label>
                      <Input
                        id="ifsc_code"
                        value={formData.bank_details.ifsc_code}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          bank_details: { ...formData.bank_details, ifsc_code: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input
                        id="bank_name"
                        value={formData.bank_details.bank_name}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          bank_details: { ...formData.bank_details, bank_name: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch_name">Branch Name</Label>
                      <Input
                        id="branch_name"
                        value={formData.bank_details.branch_name}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          bank_details: { ...formData.bank_details, branch_name: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploadingKyc}>
                    {uploadingKyc ? 'Uploading...' : 'Create Customer'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No customers found' : 'No customers yet'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowDialog(true)}>Add Your First Customer</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  {customer.contact_person && (
                    <CardDescription>{customer.contact_person}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {customer.phone}
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {customer.email}
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span className="text-xs">{customer.address}</span>
                    </div>
                  )}
                  {customer.gst_number && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">GST: {customer.gst_number}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
