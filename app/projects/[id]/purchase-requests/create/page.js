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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  ArrowLeft,
  Loader2,
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { USER_ROLE } from '@/app/constants';
import Link from 'next/link';

export default function CreatePurchaseRequestPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [mode, setMode] = useState(null); // 'full_unit' or 'component'
  const [loading, setLoading] = useState(true);

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

  // Mode selection screen
  if (!mode) {
    return (
      <div className="space-y-6">
        <div>
          <Link href={`/projects/${projectId}/purchase-requests`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Purchase Requests
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create Purchase Request</h1>
          <p className="text-muted-foreground">Choose how you want to fulfill items</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          {/* Full Unit Option */}
          <Card 
            className="cursor-pointer hover:border-primary transition-all" 
            onClick={() => setMode('full_unit')}
          >
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle>Full Unit Fulfillment</CardTitle>
                  <CardDescription className="mt-2">
                    Order items directly as estimated
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Single vendor for all items</li>
                <li>✓ Quick bulk ordering</li>
                <li>✓ Most common (95% of PRs)</li>
                <li>✓ Simple & fast</li>
              </ul>
            </CardContent>
          </Card>

          {/* Component Option */}
          <Card 
            className="cursor-pointer hover:border-primary transition-all" 
            onClick={() => setMode('component')}
          >
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Layers className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <CardTitle>Component-wise Breakdown</CardTitle>
                  <CardDescription className="mt-2">
                    Break down one item into materials
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Different vendor per component</li>
                <li>✓ Advanced material sourcing</li>
                <li>✓ For complex breakdowns</li>
                <li>✓ Percentage-based fulfillment</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render appropriate flow based on mode
  return mode === 'full_unit' ? (
    <FullUnitFlow projectId={projectId} onBack={() => setMode(null)} />
  ) : (
    <ComponentFlow projectId={projectId} onBack={() => setMode(null)} />
  );
}

// Full Unit Flow Component
function FullUnitFlow({ projectId, onBack }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  
  const [groupedItems, setGroupedItems] = useState({});
  const [allItems, setAllItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // [{id, quantity}]
  const [estimationId, setEstimationId] = useState(null);

  const [draftPRs, setDraftPRs] = useState([]);
  const [selectedPR, setSelectedPR] = useState('new');
  
  const [formData, setFormData] = useState({
    expected_delivery_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchVendors();
    fetchAvailableItems();
  }, [projectId]);

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
        toast.error('Failed to load items');
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Error loading items');
    } finally {
      setLoading(false);
    }
  };

  const fetchDraftPRs = async (vendorId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests?status=draft&vendor_id=${vendorId}`);
      if (res.ok) {
        const data = await res.json();
        setDraftPRs(data.purchase_requests || []);
      }
    } catch (error) {
      console.error('Error fetching draft PRs:', error);
    }
  };

  const handleVendorSelect = () => {
    if (!selectedVendor) {
      toast.error('Please select a vendor');
      return;
    }
    fetchDraftPRs(selectedVendor);
    setStep(2);
  };

  const handleItemToggle = (itemId) => {
    const item = allItems.find(i => i.id === itemId);
    const existing = selectedItems.find(s => s.id === itemId);
    
    if (existing) {
      setSelectedItems(selectedItems.filter(s => s.id !== itemId));
    } else {
      setSelectedItems([...selectedItems, { 
        id: itemId, 
        quantity: item.available_qty,
        item: item 
      }]);
    }
  };

  const handleQuantityChange = (itemId, newQty) => {
    const item = allItems.find(i => i.id === itemId);
    const qty = parseFloat(newQty);
    
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be positive');
      return;
    }
    if (qty > item.available_qty) {
      toast.error(`Cannot exceed available quantity (${item.available_qty})`);
      return;
    }
    
    setSelectedItems(selectedItems.map(s => 
      s.id === itemId ? { ...s, quantity: qty } : s
    ));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    try {
      setSaving(true);

      const items = selectedItems.map(sel => ({
        name: sel.item.item_name,
        quantity: sel.quantity,
        unit: sel.item.unit,
        links: [{
          estimation_item_id: sel.item.id,
          linked_qty: sel.quantity,
          weightage: 1.0,
          notes: 'Full unit fulfillment'
        }]
      }));

      if (selectedPR === 'new') {
        // Create new PR
        const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimation_id: estimationId,
            vendor_id: selectedVendor,
            status: 'draft',
            expected_delivery_date: formData.expected_delivery_date || null,
            notes: formData.notes || null,
            items: items
          })
        });

        const data = await res.json();
        if (res.ok) {
          toast.success(`Draft PR ${data.purchase_request.pr_number} created`);
          router.push(`/projects/${projectId}/purchase-requests/${data.purchase_request.id}/view`);
        } else {
          toast.error(data.error || 'Failed to create PR');
        }
      } else {
        // Add to existing PR
        const res = await fetch(`/api/projects/${projectId}/purchase-requests/${selectedPR}/add-items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });

        const data = await res.json();
        if (res.ok) {
          toast.success(`${data.items_added} item(s) added to existing PR`);
          router.push(`/projects/${projectId}/purchase-requests/${selectedPR}/view`);
        } else {
          toast.error(data.error || 'Failed to add items');
        }
      }
    } catch (error) {
      console.error('Error saving PR:', error);
      toast.error('Error saving purchase request');
    } finally {
      setSaving(false);
    }
  };

  const selectedVendorName = vendors.find(v => v.id == selectedVendor)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={step === 1 ? onBack : () => setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Full Unit Fulfillment</h1>
        <p className="text-muted-foreground">Step {step} of 4</p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Vendor</CardTitle>
            <CardDescription>All items will be ordered from this vendor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id.toString()}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleVendorSelect} disabled={!selectedVendor}>Next: Select Items</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Select Items</CardTitle>
                  <CardDescription>Vendor: {selectedVendorName}</CardDescription>
                </div>
                <Badge variant="secondary">{selectedItems.length} selected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="font-semibold capitalize mb-3">{category}</h3>
                      <div className="space-y-2">
                        {items.filter(item => item.available_qty > 0).map(item => (
                          <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50">
                            <Checkbox
                              checked={selectedItems.some(s => s.id === item.id)}
                              onCheckedChange={() => handleItemToggle(item.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{item.room_name} - {item.item_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Total: {item.total_qty} {item.unit} • 
                                Confirmed: {item.confirmed_qty} • 
                                Draft: {item.draft_qty} • 
                                <span className="text-green-600 font-medium">Available: {item.available_qty}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Button onClick={() => setStep(3)} disabled={selectedItems.length === 0}>Next: Enter Quantities</Button>
        </>
      )}

      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Enter Quantities</CardTitle>
              <CardDescription>Specify how much to order for each item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-right p-3">Available</th>
                      <th className="text-right p-3">Order Qty</th>
                      <th className="text-left p-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map(sel => (
                      <tr key={sel.id} className="border-t">
                        <td className="p-3">{sel.item.item_name}</td>
                        <td className="p-3 text-right">{sel.item.available_qty}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={sel.quantity}
                            onChange={(e) => handleQuantityChange(sel.id, e.target.value)}
                            className="w-24 text-right"
                          />
                        </td>
                        <td className="p-3">{sel.item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => setStep(4)}>Next: Choose PR</Button>
        </>
      )}

      {step === 4 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Choose Purchase Request</CardTitle>
              <CardDescription>Add to existing draft or create new</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={selectedPR} onValueChange={setSelectedPR}>
                {draftPRs.length > 0 && (
                  <div className="space-y-2">
                    {draftPRs.map(pr => (
                      <div key={pr.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                        <RadioGroupItem value={pr.id.toString()} id={`pr-${pr.id}`} />
                        <Label htmlFor={`pr-${pr.id}`} className="flex-1 cursor-pointer">
                          <div>
                            <p className="font-medium">{pr.pr_number}</p>
                            <p className="text-sm text-muted-foreground">Draft, {pr.items_count} items</p>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="new" id="pr-new" />
                  <Label htmlFor="pr-new" className="flex-1 cursor-pointer">
                    <p className="font-medium">Create New Draft PR</p>
                  </Label>
                </div>
              </RadioGroup>

              {selectedPR === 'new' && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label>Expected Delivery Date</Label>
                    <Input
                      type="date"
                      value={formData.expected_delivery_date}
                      onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Button onClick={handleSubmit} disabled={saving} size="lg" className="gap-2">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><PackagePlus className="h-4 w-4" /> Save Draft PR</>
            )}
          </Button>
        </>
      )}
    </div>
  );
}

// Component Flow - To be implemented
function ComponentFlow({ projectId, onBack }) {
  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Component-wise Breakdown</h1>
      </div>
      <Card>
        <CardContent className="p-12 text-center">
          <Layers className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Component Flow Coming Soon</p>
          <p className="text-muted-foreground">This advanced feature is under development</p>
        </CardContent>
      </Card>
    </div>
  );
}
