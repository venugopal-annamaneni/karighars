"use client";

import ComponentsBreakdownTable from '@/app/components/purchase-request/ComponentsBreakdownTable';
import EditableDirectItemsTable from '@/app/components/purchase-request/EditableDirectItemsTable';
import EstimationItemsTable from '@/app/components/purchase-request/EstimationItems';
import ModeSelector from '@/app/components/purchase-request/ModeSelector';
import SelectDraftPRStep from '@/app/components/purchase-request/SelectDraftPRStep';
import StepHeader from '@/app/components/purchase-request/StepHeader';
import Stepper from '@/app/components/purchase-request/Stepper';
import { usePRCommon } from '@/app/components/purchase-request/usePRCommon';
import { USER_ROLE } from '@/app/constants';
import { EditablePRItemsTable } from '@/components/EditablePRItemsTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  CheckCircle2,
  Layers,
  Loader2,
  PackagePlus,
  Plus,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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

  const [mode, setMode] = useState(null); // 'full_unit', 'component', or 'direct'
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
  if (!mode)
    return <ModeSelector projectId={projectId} onSelect={setMode} />;

  // Render appropriate flow based on mode
  if (mode === 'full_unit') {
    return <FullUnitFlow projectId={projectId} onBack={() => setMode(null)} />;
  } else if (mode === 'component') {
    return <ComponentFlow projectId={projectId} onBack={() => setMode(null)} />;
  } else if (mode === 'direct') {
    return <DirectPurchaseFlow projectId={projectId} onBack={() => setMode(null)} />;
  }
}

// Full Unit Flow Component
function FullUnitFlow({ projectId, onBack }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedPR, setSelectedPR] = useState('new');

  const [formData, setFormData] = useState({
    expected_delivery_date: '',
    notes: ''
  });

  const {
    loading,
    vendors,
    draftPRs,
    groupedItems,
    allItems,
    estimationId,
    fetchDraftPRs
  } = usePRCommon(projectId);

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
      <StepHeader
        title="Full Unit Fulfillment"
        subtitle="Order items directly as estimated"
        step={step}
        totalSteps={3}
        onBack={step === 1 ? onBack : () => setStep(step - 1)}
      />

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
                <EstimationItemsTable
                  groupedItems={groupedItems}
                  selectedIds={selectedItems.map((s) => s.id)}
                  mode="checkbox"
                  onSelect={(item) => handleItemToggle(item.id)}
                  loading={loading}
                />
              )}
            </CardContent>
          </Card>
          <Button onClick={() => setStep(3)} disabled={selectedItems.length === 0}>Next: Choose PR</Button>
        </>
      )}

      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Choose Purchase Request</CardTitle>
              <CardDescription>Add to existing draft or create new</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectDraftPRStep
                draftPRs={draftPRs}
                value={selectedPR}
                onChange={setSelectedPR}
                showDetails={true}
                notes={formData.notes}
                setNotes={(v) => setFormData({ ...formData, notes: v })}
                deliveryDate={formData.expected_delivery_date}
                setDeliveryDate={(v) => setFormData({ ...formData, expected_delivery_date: v })}
              />

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

  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fulfillQty, setFulfillQty] = useState('');
  const [components, setComponents] = useState([
    { name: '', width: '', height: '', quantity: '', unit: '', vendor_id: '', percentage: '' }
  ]);

  const [prSelections, setPRSelections] = useState({}); // {vendor_id: {pr_id: 'new' or prId, delivery_date, notes}}

  const {
    loading,
    vendors,
    //draftPRs,
    groupedItems,
    //allItems,
    estimationId,
    fetchDraftPRs
  } = usePRCommon(projectId);



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
      const draftPRs = await fetchDraftPRs(vendorId);
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

  // const totalPct = calculateTotalPercentage();
  // const pctColor = Math.abs(totalPct - 100) < 0.01 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <StepHeader
        title="Component-wise Breakdown"
        subtitle="Break down one estimation item into components"
        step={step}
        totalSteps={3}
        onBack={step === 1 ? onBack : () => setStep(step - 1)}
      />

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
              <EstimationItemsTable
                groupedItems={groupedItems}
                selectedId={selectedItem?.id ?? null}
                mode="radio"
                onSelect={(item) => handleItemSelect(item)}
                loading={loading}
              />
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
                      <th className="text-left p-3 text-sm font-medium">Unit</th>
                      <th className="text-left p-3 text-sm font-medium">Width</th>
                      <th className="text-left p-3 text-sm font-medium">Height</th>
                      <th className="text-right p-3 text-sm font-medium">Quantity</th>
                      <th className="text-right p-3 text-sm font-medium">Confirmed</th>
                      <th className="text-right p-3 text-sm font-medium">Draft</th>
                      <th className="text-right p-3 text-sm font-medium">Pending</th>

                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-accent/30">
                      <td className="p-3 text-sm">{selectedItem.room_name}</td>
                      <td className="p-3 text-sm font-medium">{selectedItem.item_name}</td>
                      <td className="p-3 text-sm">{selectedItem.unit}</td>
                      <td className="p-3 text-sm">{selectedItem.width ?? "-"}</td>
                      <td className="p-3 text-sm">{selectedItem.height ?? "-"}</td>
                      <td className="p-3 text-sm text-right">{selectedItem.total_qty} {selectedItem.unit}</td>
                      <td className="p-3 text-sm text-right font-bold text-green-600">{selectedItem.confirmed_qty} {selectedItem.unit}</td>
                      <td className="p-3 text-sm text-right font-bold text-blue-600">{selectedItem.draft_qty} {selectedItem.unit}</td>
                      <td className="p-3 text-sm text-right">
                        <span className="text-green-600 font-medium">{selectedItem.available_qty} {selectedItem.unit}</span>
                      </td>

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
              {/* <div>
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
              </div> */}

              {/* Components */}
              <ComponentsBreakdownTable
                components={components}
                vendors={vendors}
                updateComponent={updateComponent}
                removeComponent={removeComponent}
                addComponent={addComponent}
              />

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
                        {isAreaBasedUnit(selectedItem.unit) && (
                          <span className="text-xs ml-2">({selectedItem.width}x{selectedItem.height} {selectedItem.unit})</span>
                        )}
                        {!isAreaBasedUnit(selectedItem.unit) && (
                          <span className="text-xs ml-2">({selectedItem.quantity} {selectedItem.unit})</span>
                        )}


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

                    {/* PR Selection */}
                    <SelectDraftPRStep
                      draftPRs={selection.draft_prs}
                      value={selection.pr_id}
                      onChange={(v) => updatePRSelection(vendorId, "pr_id", v)}
                      showDetails={true}
                      notes={selection.notes}
                      setNotes={(v) => updatePRSelection(vendorId, "notes", v)}
                      deliveryDate={selection.delivery_date}
                      setDeliveryDate={(v) => updatePRSelection(vendorId, "delivery_date", v)}
                    />

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

// Direct Purchase Flow Component
function DirectPurchaseFlow({ projectId, onBack }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  //const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  //const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  //const [baseRates, setBaseRates] = useState(null);
  const [draftPRs, setDraftPRs] = useState([]);

  const [items, setItems] = useState([{
    id: Date.now(),
    name: '',
    category: '',
    room_name: '',
    unit: 'no',
    width: null,
    height: null,
    quantity: 1
  }]);

  //const [draftPRs, setDraftPRs] = useState([]);
  const [selectedPR, setSelectedPR] = useState('new');

  const [formData, setFormData] = useState({
    expected_delivery_date: '',
    notes: ''
  });

  const {
    loading,
    vendors,
    //draftPRs,
    // groupedItems,
    // allItems,
    // estimationId,
    fetchDraftPRs,
    baseRates
  } = usePRCommon(projectId);

  // const fetchVendors = async () => {
  //   try {
  //     const res = await fetch(`/api/vendors`);
  //     if (res.ok) {
  //       const data = await res.json();
  //       setVendors(data.vendors || []);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching vendors:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const fetchBaseRates = async () => {
  //   try {
  //     const baseRateRes = await fetch(`/api/projects/${projectId}/base-rates/active`);
  //     if (!baseRateRes.ok) {
  //       throw new Error('Failed to fetch active base rates');
  //     }
  //     const baseRateData = await baseRateRes.json();
  //     setBaseRates(baseRateData.activeRate);
  //   } catch (error) {
  //     console.error('Error fetching base rates:', error);
  //   }
  // };

  // const fetchDraftPRs = async (vendorId) => {
  //   try {
  //     const res = await fetch(`/api/projects/${projectId}/purchase-requests?status=draft&vendor_id=${vendorId}`);
  //     if (res.ok) {
  //       const data = await res.json();
  //       setDraftPRs(data.purchase_requests || []);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching draft PRs:', error);
  //   }
  // };

  const handleVendorChange = async (value) => {
    setSelectedVendor(value);
    if (value) {
      const draftPRs = await fetchDraftPRs(value);
      setDraftPRs(draftPRs);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedVendor) {
        toast.error('Please select a vendor');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate items
      const hasInvalidItems = items.some(item => !item.name?.trim() || !item.category);
      if (hasInvalidItems) {
        toast.error('Please fill Item Name and Category for all items');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      onBack();
    } else {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);

      if (selectedPR === 'new') {
        // Create new PR
        const payload = {
          mode: 'direct',
          estimation_id: null,
          vendor_id: parseInt(selectedVendor),
          status: 'draft',
          expected_delivery_date: formData.expected_delivery_date || null,
          notes: formData.notes || null,
          items: items.map(item => ({
            name: item.name,
            category: item.category,
            room_name: item.room_name || null,
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit,
            width: item.width ? parseFloat(item.width) : null,
            height: item.height ? parseFloat(item.height) : null
          })),
        };

        const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          toast.success(`Purchase Request ${data.purchase_request.pr_number} created successfully!`);
          router.push(`/projects/${projectId}/purchase-requests`);
        } else {
          const error = await res.json();
          toast.error(error.error || 'Failed to create purchase request');
        }
      } else {
        // Add to existing draft PR
        const payload = {
          items: items.map(item => ({
            name: item.name,
            category: item.category,
            room_name: item.room_name || null,
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit,
            width: item.width ? parseFloat(item.width) : null,
            height: item.height ? parseFloat(item.height) : null
          })),
          mode: 'direct',
        };

        const res = await fetch(`/api/projects/${projectId}/purchase-requests/${selectedPR}/add-items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          toast.success('Items added to draft PR successfully!');
          router.push(`/projects/${projectId}/purchase-requests`);
        } else {
          const error = await res.json();
          toast.error(error.error || 'Failed to add items');
        }
      }
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <StepHeader
        title="Direct Purchase"
        subtitle="Purchase items not in estimation"
        step={step}
        totalSteps={4}
        onBack={handleBack}
      />

      {/* Progress Indicator */}
      <Stepper current={step} steps={4} />


      {/* Step 1: Vendor & Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Vendor & Basic Details</CardTitle>
            <CardDescription>Select vendor and enter basic information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vendor">Vendor *</Label>
              <Select value={selectedVendor} onValueChange={handleVendorChange}>
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id.toString()}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="delivery_date">Expected Delivery Date</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions or notes"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Add Items */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Add Items</CardTitle>
            <CardDescription>Add all items you want to purchase</CardDescription>
          </CardHeader>
          <CardContent>
            {baseRates && (
              <EditableDirectItemsTable
                items={items}
                setItems={setItems}
                categories={baseRates?.category_rates?.categories || []}
              />

            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: PR Destination */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Purchase Request Destination</CardTitle>
            <CardDescription>Choose where to save these items</CardDescription>
          </CardHeader>
          <CardContent>
            <SelectDraftPRStep
              draftPRs={draftPRs}
              value={selectedPR}
              onChange={setSelectedPR}
              showDetails={false}
            />

          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Create */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Review & Create</CardTitle>
            <CardDescription>Review your purchase request before creating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Vendor</p>
                <p className="font-medium">{vendors.find(v => v.id.toString() === selectedVendor)?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="font-medium">{items.length}</p>
              </div>
              {formData.expected_delivery_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Expected Delivery</p>
                  <p className="font-medium">{new Date(formData.expected_delivery_date).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Destination</p>
                <p className="font-medium">
                  {selectedPR === 'new' ? 'New Draft PR' : draftPRs.find(pr => pr.id.toString() === selectedPR)?.pr_number}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Items Summary</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-2 border-b">Item Name</th>
                      <th className="text-left p-2 border-b">Category</th>
                      <th className="text-left p-2 border-b">Room</th>
                      <th className="text-right p-2 border-b">Quantity</th>
                      <th className="text-left p-2 border-b">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const category = baseRates?.category_rates?.categories?.find(c => c.id === item.category);
                      return (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{category?.category_name || '-'}</td>
                          <td className="p-2">{item.room_name || '-'}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2">{item.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {formData.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm p-3 bg-slate-50 rounded-lg">{formData.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < 4 ? (
          <Button onClick={handleNext}>
            Next Step
            <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving} size="lg" className="gap-2">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
            ) : (
              <><PackagePlus className="h-4 w-4" /> {selectedPR === 'new' ? 'Create Draft PR' : 'Add to Draft PR'}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}