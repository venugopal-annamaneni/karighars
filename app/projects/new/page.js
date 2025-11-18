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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [bizModels, setBizModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    project_code_suffix: '', // User enters the suffix, we'll prepend KG-
    customer_id: '',
    location: '',
    biz_model_id: '',
  });

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    customer_type: 'B2C',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_account_holder: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchCustomers();
    }
  }, [status, router]);

  const fetchCustomers = async () => {
    try {
      const [customersRes, bizModelsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/biz-models')
      ]);
      
      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.customers);
      }
      
      if (bizModelsRes.ok) {
        const data = await bizModelsRes.json();
        // Filter to only show published BizModels
        const publishedModels = data.bizModels.filter(m => m.status === 'published');
        setBizModels(publishedModels);
        // Set default to first published bizmodel
        if (publishedModels.length > 0) {
          setFormData(prev => ({ ...prev, biz_model_id: publishedModels[0].id.toString() }));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Customer created successfully');
        setShowCustomerDialog(false);
        fetchCustomers();
        setFormData({ ...formData, customer_id: data.customer.id });
        setNewCustomer({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          address: '',
          gst_number: '',
        });
      } else {
        toast.error('Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Construct full project code with KG- prefix
      const projectData = {
        ...formData,
        project_code: `KG-${formData.project_code_suffix}`,
      };
      delete projectData.project_code_suffix; // Remove the suffix field
      
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Project created successfully');
        router.push(`/projects/${data.project.id}`);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
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
      <main className="container mx-auto p-6 max-w-3xl">
        <div className="mb-6">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground mt-1">
            Start a new interior design project
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Fill in the basic information for your new project</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Luxury Villa Interior"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="customer">Customer *</Label>
                  <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1">
                        <Plus className="h-3 w-3" />
                        Add New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Customer</DialogTitle>
                        <DialogDescription>
                          Create a new customer record
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateCustomer} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="customer_name">Name *</Label>
                            <Input
                              id="customer_name"
                              value={newCustomer.name}
                              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contact_person">Contact Person</Label>
                            <Input
                              id="contact_person"
                              value={newCustomer.contact_person}
                              onChange={(e) => setNewCustomer({ ...newCustomer, contact_person: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                              id="phone"
                              value={newCustomer.phone}
                              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={newCustomer.email}
                              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gst">GST Number</Label>
                            <Input
                              id="gst"
                              value={newCustomer.gst_number}
                              onChange={(e) => setNewCustomer({ ...newCustomer, gst_number: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Address</Label>
                          <Textarea
                            id="address"
                            value={newCustomer.address}
                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setShowCustomerDialog(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Customer'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  required
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name} {customer.phone && `(${customer.phone})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., Mumbai, India"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="biz_model">Business Model *</Label>
                <Select
                  value={formData.biz_model_id}
                  onValueChange={(value) => setFormData({ ...formData, biz_model_id: value })}
                  required
                >
                  <SelectTrigger id="biz_model">
                    <SelectValue placeholder="Select a business model" />
                  </SelectTrigger>
                  <SelectContent>
                    {bizModels.map((model) => (
                      <SelectItem key={model.id} value={model.id.toString()}>
                        {model.name} ({model.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Link href="/projects">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
