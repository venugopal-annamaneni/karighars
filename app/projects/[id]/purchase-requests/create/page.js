"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft,
  ArrowRight,
  Loader2,
  PackagePlus
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { USER_ROLE } from '@/app/constants';
import Link from 'next/link';

export default function CreatePurchaseRequestPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [step, setStep] = useState(1); // 1: Select Items, 2: Details
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Items data
  const [groupedItems, setGroupedItems] = useState({});
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [allItems, setAllItems] = useState([]);

  // Vendors
  const [vendors, setVendors] = useState([]);

  // Form data
  const [prFormData, setPRFormData] = useState({
    vendor_id: '',
    expected_delivery_date: '',
    remarks: '',
    payment_terms: ''
  });

  useEffect(() => {
    fetchAvailableItems();
    fetchVendors();
  }, [projectId]);

  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/available-items`);
      if (res.ok) {
        const data = await res.json();
        setGroupedItems(data.grouped_by_category || {});
        setAllItems(data.items || []);
      } else {
        toast.error('Failed to load available items');
      }
    } catch (error) {
      console.error('Error fetching available items:', error);
      toast.error('Error loading available items');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`/api/vendors`);
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleItemToggle = (itemId) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleCategorySelectAll = (categoryItems) => {
    const categoryItemIds = categoryItems.map(item => item.id);
    const allSelected = categoryItemIds.every(id => selectedItemIds.includes(id));
    
    if (allSelected) {
      // Deselect all in this category
      setSelectedItemIds(prev => prev.filter(id => !categoryItemIds.includes(id)));
    } else {
      // Select all in this category
      setSelectedItemIds(prev => [...new Set([...prev, ...categoryItemIds])]);
    }
  };

  const handleGlobalSelectAll = () => {
    if (selectedItemIds.length === allItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(allItems.map(item => item.id));
    }
  };

  const handleNextStep = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Please select at least one item');
      return;
    }
    setStep(2);
  };

  const handleSubmitPR = async () => {
    if (!prFormData.vendor_id) {
      toast.error('Please select a vendor');
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimation_item_ids: selectedItemIds,
          ...prFormData
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Purchase Request ${data.purchase_request.pr_number} created successfully`);
        router.push(`/projects/${projectId}/purchase-requests/${data.purchase_request.id}/view`);
      } else {
        toast.error(data.error || 'Failed to create purchase request');
      }
    } catch (error) {
      console.error('Error creating PR:', error);
      toast.error('Error creating purchase request');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedItems = allItems.filter(item => selectedItemIds.includes(item.id));
  const totalAmount = selectedItems.reduce((sum, item) => sum + parseFloat(item.item_total || 0), 0);

  const canCreatePR = session?.user?.role === USER_ROLE.ESTIMATOR || session?.user?.role === USER_ROLE.ADMIN;

  if (!canCreatePR) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You don't have permission to create purchase requests</p>
        <Link href={`/projects/${projectId}/purchase-requests`}>
          <Button className="mt-4">Back to Purchase Requests</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${projectId}/purchase-requests`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Purchase Requests
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create Purchase Request</h1>
          <p className="text-muted-foreground">Step {step} of 2</p>
        </div>
        
        {step === 1 && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Selected: {selectedItemIds.length} items</p>
            <p className="text-lg font-semibold">{formatCurrency(totalAmount)}</p>
          </div>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading available items...</p>
          </CardContent>
        </Card>
      ) : step === 1 ? (
        <>
          {/* Step 1: Select Items */}
          {Object.keys(groupedItems).length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <PackagePlus className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No items available</p>
                <p className="text-muted-foreground">
                  All estimation items are either already in purchase requests or have different status
                </p>
                <Link href={`/projects/${projectId}/purchase-requests`}>
                  <Button className="mt-4">Back to Purchase Requests</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Global Select All */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedItemIds.length === allItems.length && allItems.length > 0}
                        onCheckedChange={handleGlobalSelectAll}
                      />
                      <Label className="cursor-pointer font-medium">
                        Select All Items ({allItems.length} total)
                      </Label>
                    </div>
                    <div>
                      <Badge variant="secondary">{selectedItemIds.length} selected</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category Tables */}
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([category, items]) => {
                  const categoryItemIds = items.map(item => item.id);
                  const selectedInCategory = categoryItemIds.filter(id => selectedItemIds.includes(id)).length;
                  const allCategorySelected = categoryItemIds.every(id => selectedItemIds.includes(id)) && items.length > 0;

                  return (
                    <Card key={category}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={allCategorySelected}
                              onCheckedChange={() => handleCategorySelectAll(items)}
                            />
                            <div>
                              <CardTitle className="capitalize">{category}</CardTitle>
                              <CardDescription>
                                {selectedInCategory} of {items.length} items selected
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {formatCurrency(items.filter(item => selectedItemIds.includes(item.id))
                              .reduce((sum, item) => sum + parseFloat(item.item_total || 0), 0))}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted">
                              <tr>
                                <th className="w-12 p-3"></th>
                                <th className="text-left p-3 text-sm font-medium">Room</th>
                                <th className="text-left p-3 text-sm font-medium">Item Name</th>
                                <th className="text-right p-3 text-sm font-medium">Qty</th>
                                <th className="text-left p-3 text-sm font-medium">Unit</th>
                                <th className="text-right p-3 text-sm font-medium">Unit Price</th>
                                <th className="text-right p-3 text-sm font-medium">Subtotal</th>
                                <th className="text-right p-3 text-sm font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} className="border-t hover:bg-accent/50">
                                  <td className="p-3 text-center">
                                    <Checkbox
                                      checked={selectedItemIds.includes(item.id)}
                                      onCheckedChange={() => handleItemToggle(item.id)}
                                    />
                                  </td>
                                  <td className="p-3 text-sm">{item.room_name}</td>
                                  <td className="p-3 text-sm">{item.item_name}</td>
                                  <td className="p-3 text-sm text-right">{item.quantity}</td>
                                  <td className="p-3 text-sm">{item.unit}</td>
                                  <td className="p-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                                  <td className="p-3 text-sm text-right">{formatCurrency(item.subtotal)}</td>
                                  <td className="p-3 text-sm text-right font-medium">{formatCurrency(item.item_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Summary Footer */}
              <Card className="sticky bottom-4 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Selected Items</p>
                      <p className="text-2xl font-bold">{selectedItemIds.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                    </div>
                    <Button 
                      onClick={handleNextStep} 
                      disabled={selectedItemIds.length === 0}
                      size="lg"
                      className="gap-2"
                    >
                      Next: Enter Details
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          {/* Step 2: Enter Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Request Details</CardTitle>
              <CardDescription>Enter vendor information and delivery details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Items Summary */}
              <div className="bg-accent p-4 rounded-lg">
                <h4 className="font-medium mb-2">Selected Items</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Total Items:</span>
                  <span className="text-right">{selectedItemIds.length}</span>
                  <span>Total Amount:</span>
                  <span className="text-right font-medium">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <Label>Vendor *</Label>
                  <Select value={prFormData.vendor_id} onValueChange={(value) => setPRFormData({...prFormData, vendor_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(vendor => (
                        <SelectItem key={vendor.id} value={vendor.id.toString()}>
                          {vendor.name} - {vendor.vendor_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Expected Delivery Date</Label>
                  <Input
                    type="date"
                    value={prFormData.expected_delivery_date}
                    onChange={(e) => setPRFormData({...prFormData, expected_delivery_date: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Payment Terms</Label>
                  <Input
                    placeholder="e.g., 30 days credit"
                    value={prFormData.payment_terms}
                    onChange={(e) => setPRFormData({...prFormData, payment_terms: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Remarks</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={prFormData.remarks}
                    onChange={(e) => setPRFormData({...prFormData, remarks: e.target.value})}
                    rows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleSubmitPR} 
                  disabled={isCreating || !prFormData.vendor_id}
                  size="lg"
                  className="gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Purchase Request...
                    </>
                  ) : (
                    <>
                      <PackagePlus className="h-4 w-4" />
                      Create Purchase Request
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
