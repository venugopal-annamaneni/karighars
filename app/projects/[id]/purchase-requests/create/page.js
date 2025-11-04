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
import { 
  ArrowLeft,
  ArrowRight,
  Loader2,
  PackagePlus,
  Plus,
  Trash2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { USER_ROLE } from '@/app/constants';
import Link from 'next/link';

export default function CreatePurchaseRequestPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [step, setStep] = useState(1); // 1: Define PR Items, 2: Link to Estimation Items, 3: Details
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Available estimation items
  const [groupedItems, setGroupedItems] = useState({});
  const [allItems, setAllItems] = useState([]);
  const [estimationId, setEstimationId] = useState(null);

  // Vendors
  const [vendors, setVendors] = useState([]);

  // PR Items (components to be purchased)
  const [prItems, setPRItems] = useState([]);
  const [currentPRItem, setCurrentPRItem] = useState({ name: '', quantity: '', unit: '' });

  // Links between PR items and estimation items
  const [prItemLinks, setPRItemLinks] = useState({}); // { prItemIndex: [{ estimation_item_id, linked_qty, weightage, notes }] }

  // Form data
  const [prFormData, setPRFormData] = useState({
    vendor_id: '',
    expected_delivery_date: '',
    notes: ''
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
        setEstimationId(data.estimation_id);
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

  const handleAddPRItem = () => {
    if (!currentPRItem.name || !currentPRItem.quantity || !currentPRItem.unit) {
      toast.error('Please fill all PR item fields');
      return;
    }

    const newIndex = prItems.length;
    setPRItems([...prItems, { ...currentPRItem }]);
    setPRItemLinks({ ...prItemLinks, [newIndex]: [] });
    setCurrentPRItem({ name: '', quantity: '', unit: '' });
    toast.success('PR item added');
  };

  const handleRemovePRItem = (index) => {
    const updatedItems = prItems.filter((_, i) => i !== index);
    const updatedLinks = {};
    Object.keys(prItemLinks).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {
        updatedLinks[keyIndex] = prItemLinks[keyIndex];
      } else if (keyIndex > index) {
        updatedLinks[keyIndex - 1] = prItemLinks[keyIndex];
      }
    });
    setPRItems(updatedItems);
    setPRItemLinks(updatedLinks);
  };

  const handleNextToLinking = () => {
    if (prItems.length === 0) {
      toast.error('Please add at least one PR item');
      return;
    }
    setStep(2);
  };

  const handleAddLink = (prItemIndex, estimationItemId, linkedQty, weightage, notes) => {
    if (!linkedQty || linkedQty <= 0 || !weightage || weightage <= 0) {
      toast.error('Linked quantity and weightage must be positive');
      return;
    }

    const existingLinks = prItemLinks[prItemIndex] || [];
    const updatedLinks = [
      ...existingLinks,
      {
        estimation_item_id: estimationItemId,
        linked_qty: parseFloat(linkedQty),
        weightage: parseFloat(weightage),
        notes: notes || ''
      }
    ];
    setPRItemLinks({ ...prItemLinks, [prItemIndex]: updatedLinks });
  };

  const handleRemoveLink = (prItemIndex, linkIndex) => {
    const updatedLinks = prItemLinks[prItemIndex].filter((_, i) => i !== linkIndex);
    setPRItemLinks({ ...prItemLinks, [prItemIndex]: updatedLinks });
  };

  const handleNextToDetails = () => {
    // Validate that all PR items have at least one link
    const unlinkedItems = prItems.filter((_, index) => !prItemLinks[index] || prItemLinks[index].length === 0);
    if (unlinkedItems.length > 0) {
      toast.error('All PR items must be linked to at least one estimation item');
      return;
    }
    setStep(3);
  };

  const handleSubmitPR = async () => {
    if (!prFormData.vendor_id) {
      toast.error('Please select a vendor');
      return;
    }

    try {
      setIsCreating(true);
      
      // Prepare items in API format
      const items = prItems.map((prItem, index) => ({
        name: prItem.name,
        quantity: parseFloat(prItem.quantity),
        unit: prItem.unit,
        links: prItemLinks[index] || []
      }));

      const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimation_id: estimationId,
          vendor_id: prFormData.vendor_id,
          expected_delivery_date: prFormData.expected_delivery_date || null,
          notes: prFormData.notes || null,
          items: items
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
          <p className="text-muted-foreground">Step {step} of 3</p>
        </div>
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
          {/* Step 1: Define PR Items (Components to Purchase) */}
          <Card>
            <CardHeader>
              <CardTitle>Define Purchase Request Items</CardTitle>
              <CardDescription>
                Specify the components or materials you want to purchase from the vendor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Alert */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">How Purchase Requests Work</p>
                  <p>Define the items you want to order (e.g., "Plywood - 18mm", "Hardware Kit"). In the next step, you'll link these to your estimation items with weightage to track fulfillment.</p>
                </div>
              </div>

              {/* Add PR Item Form */}
              <div className="border rounded-lg p-4 bg-accent/50">
                <h3 className="font-medium mb-4">Add New Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Item Name *</Label>
                    <Input
                      placeholder="e.g., Plywood 18mm"
                      value={currentPRItem.name}
                      onChange={(e) => setCurrentPRItem({ ...currentPRItem, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={currentPRItem.quantity}
                      onChange={(e) => setCurrentPRItem({ ...currentPRItem, quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Unit *</Label>
                    <Input
                      placeholder="e.g., sheets, kg"
                      value={currentPRItem.unit}
                      onChange={(e) => setCurrentPRItem({ ...currentPRItem, unit: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddPRItem} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {/* PR Items List */}
              {prItems.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Purchase Request Items ({prItems.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Item Name</th>
                          <th className="text-right p-3 text-sm font-medium">Quantity</th>
                          <th className="text-left p-3 text-sm font-medium">Unit</th>
                          <th className="text-center p-3 text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prItems.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-3 text-sm font-medium">{item.name}</td>
                            <td className="p-3 text-sm text-right">{item.quantity}</td>
                            <td className="p-3 text-sm">{item.unit}</td>
                            <td className="p-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemovePRItem(index)}
                                className="gap-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-end">
                <Button 
                  onClick={handleNextToLinking} 
                  disabled={prItems.length === 0}
                  size="lg"
                  className="gap-2"
                >
                  Next: Link to Estimation Items
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : step === 2 ? (
        <>
          {/* Step 2: Link PR Items to Estimation Items */}
          <LinkingStepComponent
            prItems={prItems}
            prItemLinks={prItemLinks}
            groupedItems={groupedItems}
            allItems={allItems}
            onAddLink={handleAddLink}
            onRemoveLink={handleRemoveLink}
            onBack={() => setStep(1)}
            onNext={handleNextToDetails}
          />
        </>
      ) : (
        <>
          {/* Step 3: Vendor and Delivery Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Request Details</CardTitle>
              <CardDescription>Enter vendor information and delivery details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="bg-accent p-4 rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Total PR Items:</span>
                  <span className="text-right">{prItems.length}</span>
                  <span>Total Links:</span>
                  <span className="text-right">
                    {Object.values(prItemLinks).reduce((sum, links) => sum + links.length, 0)}
                  </span>
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
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={prFormData.notes}
                    onChange={(e) => setPRFormData({...prFormData, notes: e.target.value})}
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
                  onClick={() => setStep(2)}
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

// Linking Step Component
function LinkingStepComponent({ prItems, prItemLinks, groupedItems, allItems, onAddLink, onRemoveLink, onBack, onNext }) {
  const [selectedPRItemIndex, setSelectedPRItemIndex] = useState(0);
  const [linkForm, setLinkForm] = useState({
    estimation_item_id: '',
    linked_qty: '',
    weightage: '',
    notes: ''
  });

  const handleAddLinkClick = () => {
    if (!linkForm.estimation_item_id || !linkForm.linked_qty || !linkForm.weightage) {
      toast.error('Please fill all required fields');
      return;
    }

    onAddLink(
      selectedPRItemIndex,
      linkForm.estimation_item_id,
      linkForm.linked_qty,
      linkForm.weightage,
      linkForm.notes
    );

    setLinkForm({ estimation_item_id: '', linked_qty: '', weightage: '', notes: '' });
    toast.success('Link added successfully');
  };

  const getEstimationItemDetails = (itemId) => {
    return allItems.find(item => item.id === itemId);
  };

  const currentPRItem = prItems[selectedPRItemIndex];
  const currentLinks = prItemLinks[selectedPRItemIndex] || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Link PR Items to Estimation Items</CardTitle>
          <CardDescription>
            Define how each purchase request item contributes to fulfilling estimation items using weightage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Understanding Weightage</p>
              <p>Weightage represents how much of the PR item is needed per unit of the estimation item. For example: If you need 0.5 sheets of plywood per sqft of wardrobe, weightage = 0.5</p>
            </div>
          </div>

          {/* PR Item Selector */}
          <div>
            <Label>Select PR Item to Link</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {prItems.map((item, index) => {
                const links = prItemLinks[index] || [];
                const isSelected = selectedPRItemIndex === index;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedPRItemIndex(index)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.quantity} {item.unit}</p>
                    <Badge variant={links.length > 0 ? "default" : "secondary"} className="mt-2">
                      {links.length} link{links.length !== 1 ? 's' : ''}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current PR Item Details */}
          {currentPRItem && (
            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">Linking: {currentPRItem.name}</h3>

              {/* Add Link Form */}
              <div className="bg-accent/50 p-4 rounded-lg space-y-4">
                <h4 className="text-sm font-medium">Add New Link</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Estimation Item *</Label>
                    <Select 
                      value={linkForm.estimation_item_id} 
                      onValueChange={(value) => setLinkForm({ ...linkForm, estimation_item_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select estimation item" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(groupedItems).map(([category, items]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                              {category}
                            </div>
                            {items.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.room_name} - {item.item_name} ({item.available_qty} {item.unit} available)
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Linked Quantity *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Quantity from estimation"
                      value={linkForm.linked_qty}
                      onChange={(e) => setLinkForm({ ...linkForm, linked_qty: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Weightage * (per unit)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="e.g., 0.5"
                      value={linkForm.weightage}
                      onChange={(e) => setLinkForm({ ...linkForm, weightage: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      placeholder="Optional notes"
                      value={linkForm.notes}
                      onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddLinkClick} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Link
                </Button>
              </div>

              {/* Current Links */}
              {currentLinks.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Current Links ({currentLinks.length})</h4>
                  <div className="space-y-2">
                    {currentLinks.map((link, linkIndex) => {
                      const estItem = getEstimationItemDetails(link.estimation_item_id);
                      return (
                        <div key={linkIndex} className="border rounded-lg p-3 flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {estItem ? `${estItem.category} - ${estItem.room_name} - ${estItem.item_name}` : 'Unknown Item'}
                            </p>
                            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Linked Qty: {link.linked_qty}</span>
                              <span>Weightage: {link.weightage}</span>
                            </div>
                            {link.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{link.notes}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveLink(selectedPRItemIndex, linkIndex)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={onBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={onNext}
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
  );
}
