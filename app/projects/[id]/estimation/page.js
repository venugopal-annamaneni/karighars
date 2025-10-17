"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';

export default function EstimationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    remarks: '',
    status: 'draft',
    service_charge_percentage: 0,
    discount_percentage: 0,
    gst_percentage: 18
  });
  
  const [items, setItems] = useState([
    {
      category: 'woodwork',
      description: '',
      quantity: 1,
      unit: 'sqft',
      unit_price: 0,
      vendor_type: 'PI',
      estimated_cost: 0,
      estimated_margin: 0
    }
  ]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchProject();
    }
  }, [status, router, projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        
        // Load existing estimation if available
        if (data.estimation) {
          setFormData({
            remarks: data.estimation.remarks || '',
            status: data.estimation.status,
            service_charge_percentage: data.estimation.service_charge_percentage || 0,
            discount_percentage: data.estimation.discount_percentage || 0,
            gst_percentage: data.estimation.gst_percentage || 18
          });
          
          const itemsRes = await fetch(`/api/estimation-items/${data.estimation.id}`);
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            if (itemsData.items.length > 0) {
              setItems(itemsData.items.map(item => ({
                category: item.category,
                description: item.description,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unit_price: parseFloat(item.unit_price),
                vendor_type: item.vendor_type,
                estimated_cost: parseFloat(item.estimated_cost || 0),
                estimated_margin: parseFloat(item.estimated_margin || 0)
              })));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      category: 'woodwork',
      description: '',
      quantity: 1,
      unit: 'sqft',
      unit_price: 0,
      vendor_type: 'PI',
      estimated_cost: 0,
      estimated_margin: 0
    }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Auto-calculate margin
    if (field === 'unit_price' || field === 'estimated_cost') {
      const unitPrice = parseFloat(newItems[index].unit_price) || 0;
      const estimatedCost = parseFloat(newItems[index].estimated_cost) || 0;
      if (unitPrice > 0 && estimatedCost > 0) {
        newItems[index].estimated_margin = ((unitPrice - estimatedCost) / unitPrice * 100).toFixed(2);
      }
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    let woodwork = 0;
    let misc_internal = 0;
    let misc_external = 0;
    
    items.forEach(item => {
      const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      if (item.category === 'woodwork') {
        woodwork += total;
      } else if (item.category === 'misc_internal') {
        misc_internal += total;
      } else if (item.category === 'misc_external') {
        misc_external += total;
      }
    });
    
    const subtotal = woodwork + misc_internal + misc_external;
    const serviceCharge = (subtotal * (formData.service_charge_percentage || 0)) / 100;
    const discount = (subtotal * (formData.discount_percentage || 0)) / 100;
    const finalTotal = subtotal + serviceCharge - discount;
    const gstAmount = (finalTotal * (formData.gst_percentage || 0)) / 100;
    const grandTotal = finalTotal + gstAmount;
    
    return {
      woodwork_value: woodwork,
      misc_internal_value: misc_internal,
      misc_external_value: misc_external,
      total_value: subtotal,  // Send RAW subtotal to backend
      subtotal: subtotal,
      service_charge: serviceCharge,
      discount: discount,
      final_value: finalTotal,
      gst_amount: gstAmount,
      grand_total: grandTotal
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const totals = calculateTotals();
      
      const res = await fetch('/api/estimations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          ...totals,
          remarks: formData.remarks,
          status: formData.status,
          service_charge_percentage: formData.service_charge_percentage,
          discount_percentage: formData.discount_percentage,
          gst_percentage: formData.gst_percentage,
          items: items.filter(item => item.description.trim() !== '')
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Check if overpayment was detected
        if (data.warning === 'overpayment_detected' && data.overpayment) {
          // Show overpayment alert
          toast.warning(
            `⚠️ OVERPAYMENT DETECTED: ₹${data.overpayment.amount.toLocaleString('en-IN')}. ` +
            `Admin approval required. ${data.overpayment.message}`,
            { duration: 10000 }
          );
          
          // Show confirmation dialog
          if (confirm(
            `⚠️ OVERPAYMENT ALERT\n\n` +
            `This estimation revision creates an overpayment of ₹${data.overpayment.amount.toLocaleString('en-IN')}.\n\n` +
            `Total Collected: ₹${(data.estimation.final_value + data.estimation.gst_amount + data.overpayment.amount).toLocaleString('en-IN')}\n` +
            `New Estimation: ₹${(data.estimation.final_value + data.estimation.gst_amount).toLocaleString('en-IN')}\n\n` +
            `Status: ${data.overpayment.status}\n\n` +
            `Next steps:\n` +
            `1. Admin must approve the overpayment\n` +
            `2. Create credit reversal entry\n` +
            `3. Finance uploads credit note\n\n` +
            `Go to project page to approve?`
          )) {
            router.push(`/projects/${projectId}`);
          }
        } else {
          toast.success('Estimation saved successfully');
          router.push(`/projects/${projectId}`);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save estimation');
      }
    } catch (error) {
      console.error('Error saving estimation:', error);
      toast.error('An error occurred');
    } finally {
      setSaving(false);
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

  if (!session || !project) return null;

  const totals = calculateTotals();
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Toaster richColors position="top-right" />
      <main className="container mx-auto p-6 max-w-7xl space-y-6">
        <div>
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Project
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Project Estimation</h1>
          <p className="text-muted-foreground mt-1">{project.name}</p>
        </div>

        {/* Totals Summary */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Woodwork</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totals.woodwork_value)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Misc Internal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totals.misc_internal_value)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Misc External</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totals.misc_external_value)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Service Charge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">+{formatCurrency(totals.service_charge || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Discount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">-{formatCurrency(totals.discount || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GST ({formData.gst_percentage}%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600">+{formatCurrency(totals.gst_amount || 0)}</div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">Grand Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totals.grand_total)}</div>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Estimation Items</CardTitle>
                  <CardDescription>Add all project items with pricing details</CardDescription>
                </div>
                <Button type="button" onClick={addItem} variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">Item #{index + 1}</p>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Category</Label>
                        <Select
                          value={item.category}
                          onValueChange={(value) => updateItem(index, 'category', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="woodwork">Woodwork</SelectItem>
                            <SelectItem value="misc_internal">Misc Internal</SelectItem>
                            <SelectItem value="misc_external">Misc External</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          placeholder="e.g., Modular Kitchen"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="h-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateItem(index, 'unit', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sqft">Sqft</SelectItem>
                            <SelectItem value="rft">Rft</SelectItem>
                            <SelectItem value="nos">Nos</SelectItem>
                            <SelectItem value="lumpsum">Lumpsum</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Vendor Type</Label>
                        <Select
                          value={item.vendor_type}
                          onValueChange={(value) => updateItem(index, 'vendor_type', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PI">PI</SelectItem>
                            <SelectItem value="Aristo">Aristo</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Total</Label>
                        <Input
                          value={formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                          disabled
                          className="h-9 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="finalized">Finalized</SelectItem>
                        <SelectItem value="locked">Locked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Service Charge (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={formData.service_charge_percentage}
                        onChange={(e) => setFormData({ ...formData, service_charge_percentage: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={formData.discount_percentage}
                        onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>GST (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="18"
                        value={formData.gst_percentage}
                        onChange={(e) => setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    placeholder="Add any notes about this estimation..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Link href={`/projects/${projectId}`}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Estimation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
