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

// Helper function to check if unit is area-based (sqft)
const isAreaBasedUnit = (unit) => {
  if (!unit) return false;
  const unitLower = unit.toLowerCase().trim();
  const areaUnits = ['sqft', 'sq.ft', 'square feet', 'sq ft', 'sq. ft'];
  return areaUnits.includes(unitLower);
};

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
        width: item.width || '',
        height: item.height || '',
        quantity: item.available_qty,
        item: item 
      }]);
    }
  };

  const handleDimensionChange = (itemId, field, value) => {
    const item = allItems.find(i => i.id === itemId);
    const updated = selectedItems.map(s => {
      if (s.id === itemId) {
        const newData = { ...s, [field]: value };
        // Auto-calculate quantity for area-based units
        if (isAreaBasedUnit(item.unit)) {
          const w = parseFloat(field === 'width' ? value : newData.width) || 0;
          const h = parseFloat(field === 'height' ? value : newData.height) || 0;
          newData.quantity = w * h;
        }
        return newData;
      }
      return s;
    });
    setSelectedItems(updated);
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
        width: sel.width || null,
        height: sel.height || null,
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
                  {Object.entries(groupedItems).map(([category, items]) => {
                    const availableItems = items.filter(item => item.available_qty > 0);
                    if (availableItems.length === 0) return null;
                    
                    return (
                      <div key={category}>
                        <h3 className="font-semibold capitalize mb-3">{category}</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="w-12 p-3"></th>
                                <th className="text-left p-3 font-medium">Room</th>
                                <th className="text-left p-3 font-medium">Item Name</th>
                                <th className="text-right p-3 font-medium">Width</th>
                                <th className="text-right p-3 font-medium">Height</th>
                                <th className="text-right p-3 font-medium">Quantity</th>
                                <th className="text-right p-3 font-medium">Total</th>
                                <th className="text-right p-3 font-medium">Confirmed</th>
                                <th className="text-right p-3 font-medium">Draft</th>
                                <th className="text-right p-3 font-medium">Available</th>
                                <th className="text-left p-3 font-medium">Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableItems.map(item => (
                                <tr 
                                  key={item.id}
                                  className="border-t hover:bg-accent/50"
                                >
                                  <td className="p-3 text-center">
                                    <Checkbox
                                      checked={selectedItems.some(s => s.id === item.id)}
                                      onCheckedChange={() => handleItemToggle(item.id)}
                                    />
                                  </td>
                                  <td className="p-3">{item.room_name}</td>
                                  <td className="p-3 font-medium">{item.item_name}</td>
                                  <td className="p-3 text-right">{item.width || '-'}</td>
                                  <td className="p-3 text-right">{item.height || '-'}</td>
                                  <td className="p-3 text-right">{item.quantity || '-'}</td>
                                  <td className="p-3 text-right">{item.total_qty}</td>
                                  <td className="p-3 text-right">{item.confirmed_qty}</td>
                                  <td className="p-3 text-right">{item.draft_qty}</td>
                                  <td className="p-3 text-right">
                                    <span className="text-green-600 font-medium">{item.available_qty}</span>
                                  </td>
                                  <td className="p-3">{item.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
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
              <CardDescription>Specify dimensions or quantities for each item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-right p-3">Available</th>
                      <th className="text-center p-3">Width</th>
                      <th className="text-center p-3">Height</th>
                      <th className="text-right p-3">Quantity</th>
                      <th className="text-left p-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map(sel => {
                      const isAreaBased = isAreaBasedUnit(sel.item.unit);
                      return (
                        <tr key={sel.id} className="border-t">
                          <td className="p-3">{sel.item.item_name}</td>
                          <td className="p-3 text-right text-green-600 font-medium">
                            {sel.item.available_qty}
                          </td>
                          {isAreaBased ? (
                            <>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={sel.width}
                                  onChange={(e) => handleDimensionChange(sel.id, 'width', e.target.value)}
                                  className="w-20 text-right"
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-3 text-center">×</td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={sel.height}
                                  onChange={(e) => handleDimensionChange(sel.id, 'height', e.target.value)}
                                  className="w-20 text-right"
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-3 text-right font-medium">
                                = {sel.quantity || 0}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 text-center text-muted-foreground">-</td>
                              <td className="p-3 text-center text-muted-foreground"></td>
                              <td className="p-3 text-center text-muted-foreground">-</td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={sel.quantity}
                                  onChange={(e) => handleQuantityChange(sel.id, e.target.value)}
                                  className="w-24 text-right"
                                  placeholder="0"
                                />
                              </td>
                            </>
                          )}
                          <td className="p-3">{sel.item.unit}</td>
                        </tr>
                      );
                    })}
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

// Component Flow Component
function ComponentFlow({ projectId, onBack }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendors, setVendors] = useState([]);
  const [groupedItems, setGroupedItems] = useState({});
  const [allItems, setAllItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [estimationId, setEstimationId] = useState(null);

  const [fulfillQty, setFulfillQty] = useState('');
  const [components, setComponents] = useState([
    { name: '', width: '', height: '', quantity: '', unit: '', vendor_id: '', percentage: '' }
  ]);

  const [prSelections, setPRSelections] = useState({}); // {vendor_id: {pr_id: 'new' or prId, delivery_date, notes}}

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

  const fetchDraftPRsForVendor = async (vendorId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests?status=draft&vendor_id=${vendorId}`);
      if (res.ok) {
        const data = await res.json();
        return data.purchase_requests || [];
      }
    } catch (error) {
      console.error('Error fetching draft PRs:', error);
    }
    return [];
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setFulfillQty(item.available_qty.toString());
    setStep(2);
  };

  const addComponent = () => {
    setComponents([...components, { name: '', width: '', height: '', quantity: '', unit: '', vendor_id: '', percentage: '' }]);
  };

  const removeComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index, field, value) => {
    const updated = [...components];
    updated[index][field] = value;
    
    // Auto-calculate quantity for area-based units
    if (field === 'width' || field === 'height' || field === 'unit') {
      const comp = updated[index];
      if (isAreaBasedUnit(comp.unit)) {
        const w = parseFloat(comp.width) || 0;
        const h = parseFloat(comp.height) || 0;
        updated[index].quantity = w * h;
      }
    }
    
    setComponents(updated);
  };

  const calculateTotalPercentage = () => {
    return components.reduce((sum, c) => {
      const pct = parseFloat(c.percentage) || 0;
      return sum + pct;
    }, 0);
  };

  const validateComponents = () => {
    // Check all fields filled
    for (const comp of components) {
      if (!comp.name || !comp.quantity || !comp.unit || !comp.vendor_id || !comp.percentage) {
        toast.error('All component fields are required');
        return false;
      }
      if (parseFloat(comp.quantity) <= 0) {
        toast.error('Component quantity must be positive');
        return false;
      }
      if (parseFloat(comp.percentage) <= 0) {
        toast.error('Component percentage must be positive');
        return false;
      }
    }

    // Check percentage sum
    const total = calculateTotalPercentage();
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Percentages must sum to 100% (current: ${total.toFixed(2)}%)`);
      return false;
    }

    // Check fulfill quantity
    const qty = parseFloat(fulfillQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Fulfill quantity must be positive');
      return false;
    }
    if (qty > selectedItem.available_qty) {
      toast.error(`Cannot exceed available quantity (${selectedItem.available_qty})`);
      return false;
    }

    return true;
  };

  const handleNextToPRSelection = async () => {
    if (!validateComponents()) return;

    // Group components by vendor and fetch draft PRs
    const vendorIds = [...new Set(components.map(c => c.vendor_id))];
    const selections = {};
    
    for (const vendorId of vendorIds) {
      const draftPRs = await fetchDraftPRsForVendor(vendorId);
      selections[vendorId] = {
        pr_id: 'new',
        draft_prs: draftPRs,
        delivery_date: '',
        notes: ''
      };
    }

    setPRSelections(selections);
    setStep(3);
  };

  const updatePRSelection = (vendorId, field, value) => {
    setPRSelections({
      ...prSelections,
      [vendorId]: {
        ...prSelections[vendorId],
        [field]: value
      }
    });
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);

      const qty = parseFloat(fulfillQty);
      const vendorGroups = {};

      // Group components by vendor
      components.forEach(comp => {
        if (!vendorGroups[comp.vendor_id]) {
          vendorGroups[comp.vendor_id] = [];
        }
        vendorGroups[comp.vendor_id].push(comp);
      });

      // Process each vendor group
      const results = [];
      for (const [vendorId, vendorComponents] of Object.entries(vendorGroups)) {
        const selection = prSelections[vendorId];
        const items = vendorComponents.map(comp => ({
          name: comp.name,
          width: comp.width || null,
          height: comp.height || null,
          quantity: parseFloat(comp.quantity),
          unit: comp.unit,
          links: [{
            estimation_item_id: selectedItem.id,
            linked_qty: qty,
            weightage: parseFloat(comp.percentage) / 100,
            notes: `Component breakdown: ${comp.percentage}%`
          }]
        }));

        if (selection.pr_id === 'new') {
          // Create new PR
          const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estimation_id: estimationId,
              vendor_id: vendorId,
              status: 'draft',
              expected_delivery_date: selection.delivery_date || null,
              notes: selection.notes || null,
              items: items
            })
          });

          const data = await res.json();
          if (res.ok) {
            results.push({ type: 'created', pr_number: data.purchase_request.pr_number });
          } else {
            throw new Error(data.error || 'Failed to create PR');
          }
        } else {
          // Add to existing PR
          const res = await fetch(`/api/projects/${projectId}/purchase-requests/${selection.pr_id}/add-items`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });

          const data = await res.json();
          if (res.ok) {
            results.push({ type: 'updated', items_added: data.items_added, pr_id: selection.pr_id });
          } else {
            throw new Error(data.error || 'Failed to add items');
          }
        }
      }

      // Show success message
      const created = results.filter(r => r.type === 'created');
      const updated = results.filter(r => r.type === 'updated');
      
      let message = '';
      if (created.length > 0) {
        message += `Created: ${created.map(r => r.pr_number).join(', ')}. `;
      }
      if (updated.length > 0) {
        message += `Updated ${updated.length} PR(s). `;
      }
      
      toast.success(message);

      // Navigate to first PR
      if (results.length > 0) {
        const firstResult = results[0];
        const targetId = firstResult.type === 'created' ? 
          results[0].pr_id : 
          prSelections[Object.keys(prSelections)[0]].pr_id;
        
        router.push(`/projects/${projectId}/purchase-requests`);
      }

    } catch (error) {
      console.error('Error saving component breakdown:', error);
      toast.error(error.message || 'Error saving purchase requests');
    } finally {
      setSaving(false);
    }
  };

  const totalPct = calculateTotalPercentage();
  const pctColor = Math.abs(totalPct - 100) < 0.01 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 mb-2" 
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Component-wise Breakdown</h1>
        <p className="text-muted-foreground">Step {step} of 3</p>
      </div>

      {/* Step 1: Select Item */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Estimation Item</CardTitle>
            <CardDescription>Choose ONE item to break down into components</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([category, items]) => {
                  const availableItems = items.filter(item => item.available_qty > 0);
                  if (availableItems.length === 0) return null;
                  
                  return (
                    <div key={category}>
                      <h3 className="font-semibold capitalize mb-3">{category}</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="w-12 p-3"></th>
                              <th className="text-left p-3 text-sm font-medium">Room</th>
                              <th className="text-left p-3 text-sm font-medium">Item Name</th>
                              <th className="text-right p-3 text-sm font-medium">Total</th>
                              <th className="text-right p-3 text-sm font-medium">Confirmed</th>
                              <th className="text-right p-3 text-sm font-medium">Draft</th>
                              <th className="text-right p-3 text-sm font-medium">Available</th>
                              <th className="text-left p-3 text-sm font-medium">Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableItems.map(item => (
                              <tr 
                                key={item.id}
                                onClick={() => handleItemSelect(item)}
                                className="border-t hover:bg-accent/50 cursor-pointer transition-colors"
                              >
                                <td className="p-3 text-center">
                                  <input
                                    type="radio"
                                    name="selected-item"
                                    checked={selectedItem?.id === item.id}
                                    onChange={() => handleItemSelect(item)}
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3 text-sm">{item.room_name}</td>
                                <td className="p-3 text-sm font-medium">{item.item_name}</td>
                                <td className="p-3 text-sm text-right">{item.total_qty}</td>
                                <td className="p-3 text-sm text-right">{item.confirmed_qty}</td>
                                <td className="p-3 text-sm text-right">{item.draft_qty}</td>
                                <td className="p-3 text-sm text-right">
                                  <span className="text-green-600 font-medium">{item.available_qty}</span>
                                </td>
                                <td className="p-3 text-sm">{item.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Add Components */}
      {step === 2 && selectedItem && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Define Components</CardTitle>
              <CardDescription>Selected item to break down:</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Item Display */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Room</th>
                      <th className="text-left p-3 text-sm font-medium">Item Name</th>
                      <th className="text-right p-3 text-sm font-medium">Total</th>
                      <th className="text-right p-3 text-sm font-medium">Confirmed</th>
                      <th className="text-right p-3 text-sm font-medium">Draft</th>
                      <th className="text-right p-3 text-sm font-medium">Available</th>
                      <th className="text-left p-3 text-sm font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-accent/30">
                      <td className="p-3 text-sm">{selectedItem.room_name}</td>
                      <td className="p-3 text-sm font-medium">{selectedItem.item_name}</td>
                      <td className="p-3 text-sm text-right">{selectedItem.total_qty}</td>
                      <td className="p-3 text-sm text-right">{selectedItem.confirmed_qty}</td>
                      <td className="p-3 text-sm text-right">{selectedItem.draft_qty}</td>
                      <td className="p-3 text-sm text-right">
                        <span className="text-green-600 font-medium">{selectedItem.available_qty}</span>
                      </td>
                      <td className="p-3 text-sm">{selectedItem.unit}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Info Alert */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-blue-900 mb-2">How Component Breakdown Works</p>
                <ul className="text-blue-800 space-y-1">
                  <li>• Each component represents a material or item to be purchased</li>
                  <li>• Fulfillment % shows how much this component contributes (must total 100%)</li>
                  <li>• Different components can be from different vendors</li>
                  <li>• Example: Wardrobe = 60% Plywood + 30% Hardware + 10% Laminate</li>
                </ul>
              </div>

              {/* Fulfill Quantity */}
              <div>
                <Label>Quantity to Fulfill</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    step="0.01"
                    value={fulfillQty}
                    onChange={(e) => setFulfillQty(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedItem.unit} (max: {selectedItem.available_qty})
                  </span>
                </div>
              </div>

              {/* Components */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label>Components</Label>
                  <div className={`text-sm font-medium ${pctColor}`}>
                    Total: {totalPct.toFixed(1)}% {Math.abs(totalPct - 100) < 0.01 ? '✓' : ''}
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Component Name</th>
                        <th className="text-left p-3 font-medium">Vendor</th>
                        <th className="text-left p-3 font-medium">Unit</th>
                        <th className="text-right p-3 font-medium">Width</th>
                        <th className="text-center p-3 font-medium"></th>
                        <th className="text-right p-3 font-medium">Height</th>
                        <th className="text-right p-3 font-medium">Quantity</th>
                        <th className="text-right p-3 font-medium">%</th>
                        <th className="text-center p-3 font-medium w-[80px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((comp, index) => {
                        const isAreaBased = isAreaBasedUnit(comp.unit);
                        return (
                          <tr key={index} className="border-t">
                            <td className="p-3">
                              <Input
                                placeholder="e.g., Plywood 18mm"
                                value={comp.name}
                                onChange={(e) => updateComponent(index, 'name', e.target.value)}
                                className="h-9"
                              />
                            </td>
                            <td className="p-3">
                              <Select 
                                value={comp.vendor_id} 
                                onValueChange={(v) => updateComponent(index, 'vendor_id', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {vendors.map(vendor => (
                                    <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                      {vendor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Select 
                                value={comp.unit} 
                                onValueChange={(v) => updateComponent(index, 'unit', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sqft">Sq.ft</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="lumpsum">Lumpsum</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            {isAreaBased ? (
                              <>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={comp.width}
                                    onChange={(e) => updateComponent(index, 'width', e.target.value)}
                                    className="h-9 w-20 text-right"
                                  />
                                </td>
                                <td className="p-3 text-center">×</td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={comp.height}
                                    onChange={(e) => updateComponent(index, 'height', e.target.value)}
                                    className="h-9 w-20 text-right"
                                  />
                                </td>
                                <td className="p-3 text-right font-medium">
                                  = {comp.quantity || 0}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 text-center text-muted-foreground">-</td>
                                <td className="p-3"></td>
                                <td className="p-3 text-center text-muted-foreground">-</td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={comp.quantity}
                                    onChange={(e) => updateComponent(index, 'quantity', e.target.value)}
                                    className="h-9 w-24 text-right"
                                  />
                                </td>
                              </>
                            )}
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="0"
                                value={comp.percentage}
                                onChange={(e) => updateComponent(index, 'percentage', e.target.value)}
                                className="h-9 w-20 text-right"
                              />
                            </td>
                            <td className="p-3 text-center">
                              {components.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeComponent(index)}
                                  className="h-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Button onClick={addComponent} variant="outline" className="w-full gap-2 mt-2">
                  <Plus className="h-4 w-4" />
                  Add Component
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleNextToPRSelection} disabled={components.length === 0}>
            Next: Choose Purchase Requests
          </Button>
        </>
      )}

      {/* Step 3: Choose PR per Vendor */}
      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Choose Purchase Requests</CardTitle>
              <CardDescription>Select destination for each vendor's components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(prSelections).map(([vendorId, selection]) => {
                const vendor = vendors.find(v => v.id == vendorId);
                const vendorComps = components.filter(c => c.vendor_id == vendorId);

                return (
                  <div key={vendorId} className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold">{vendor?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {vendorComps.length} component(s)
                      </p>
                    </div>

                    {/* Estimation Item Being Fulfilled */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-900 mb-1">Fulfilling Estimation Item:</p>
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">{selectedItem.room_name}</span> - {selectedItem.item_name}
                        <span className="text-xs ml-2">({fulfillQty} {selectedItem.unit})</span>
                      </p>
                    </div>

                    {/* Components List Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 font-medium">Component</th>
                            <th className="text-right p-2 font-medium">Width × Height</th>
                            <th className="text-right p-2 font-medium">Quantity</th>
                            <th className="text-left p-2 font-medium">Unit</th>
                            <th className="text-right p-2 font-medium">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendorComps.map((comp, idx) => {
                            const isAreaBased = isAreaBasedUnit(comp.unit);
                            const dimensionDisplay = isAreaBased && comp.width && comp.height 
                              ? `${comp.width} × ${comp.height}` 
                              : '-';
                            return (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{comp.name}</td>
                                <td className="p-2 text-right text-muted-foreground">{dimensionDisplay}</td>
                                <td className="p-2 text-right font-medium">{comp.quantity}</td>
                                <td className="p-2">{comp.unit}</td>
                                <td className="p-2 text-right">{comp.percentage}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <RadioGroup 
                      value={selection.pr_id} 
                      onValueChange={(v) => updatePRSelection(vendorId, 'pr_id', v)}
                    >
                      {selection.draft_prs?.length > 0 && (
                        <div className="space-y-2">
                          {selection.draft_prs.map(pr => (
                            <div key={pr.id} className="flex items-center space-x-2 p-2 border rounded">
                              <RadioGroupItem value={pr.id.toString()} id={`pr-${pr.id}`} />
                              <Label htmlFor={`pr-${pr.id}`} className="flex-1 cursor-pointer">
                                <div>
                                  <p className="font-medium text-sm">{pr.pr_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Draft, {pr.items_count} items
                                  </p>
                                </div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center space-x-2 p-2 border rounded">
                        <RadioGroupItem value="new" id={`pr-new-${vendorId}`} />
                        <Label htmlFor={`pr-new-${vendorId}`} className="cursor-pointer">
                          Create New Draft PR
                        </Label>
                      </div>
                    </RadioGroup>

                    {selection.pr_id === 'new' && (
                      <div className="pt-3 border-t">
                        <div>
                          <Label className="text-xs">Notes</Label>
                          <Textarea
                            value={selection.notes}
                            onChange={(e) => updatePRSelection(vendorId, 'notes', e.target.value)}
                            rows={2}
                            placeholder="Optional notes for this PR"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} disabled={saving} size="lg" className="gap-2">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><PackagePlus className="h-4 w-4" /> Save Draft PR(s)</>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
