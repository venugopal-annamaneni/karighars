"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ESTIMATION_CATEGORY, ESTIMATION_STATUS } from '@/app/constants';
import { AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useProjectData } from "@/app/context/ProjectDataContext";



export default function ProjectEstimationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;


  const [itemsLoading, setItemsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOverpaymentModal, setShowOverpaymentModal] = useState(false);
  const [overpaymentData, setOverpaymentData] = useState(null);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);
  const [bizModel, setBizModel] = useState({
    gst_percentage: ''
  });

  const [formData, setFormData] = useState({
    remarks: '',
    status: ESTIMATION_STATUS.DRAFT,
  });

  const [items, setItems] = useState([
    {
      room_name: '',
      category: '',
      description: '',
      unit: 'sqft',
      width: '',
      height: '',
      quantity: 1,
      unit_price: 0,
      karighar_charges_percentage: 0,
      discount_percentage: 0,
      gst_percentage: 0,
      vendor_type: ''
    }
  ]);
  const { fetchProjectData, project, estimation, loading } = useProjectData();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router, projectId]);

  useEffect(() => {
    if (project && project.id)
      fetchEstimationDetails();
  }, [loading])

  const fetchEstimationDetails = async () => {
    try {

      // Load biz model details
      const bizModelRes = await fetch(`/api/biz-models/${project.biz_model_id}`);
      let bizModelData = null;
      if (bizModelRes.ok) {
        bizModelData = await bizModelRes.json();
        setBizModel(bizModelData.model);
      } else {
        throw new Error('Failed to fetch business model');
      }

      // Load existing estimation if available
      if (estimation && estimation.id) {
        setFormData({
          remarks: estimation.remarks || '',
          status: estimation.status,
        });

        const itemsRes = await fetch(`/api/projects/${projectId}/estimations/${estimation.id}/items`);
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          if (itemsData.items.length > 0) {
            setItems(itemsData.items.map(item => ({
              room_name: item.room_name || '',
              category: item.category,
              description: item.description,
              unit: item.unit || 'sqft',
              width: item.width || '',
              height: item.height || '',
              quantity: parseFloat(item.quantity),
              unit_price: parseFloat(item.unit_price),
              karighar_charges_percentage: parseFloat(item.karighar_charges_percentage),
              discount_percentage: parseFloat(item.discount_percentage),
              gst_percentage: parseFloat(item.gst_percentage),
              vendor_type: item.vendor_type
            })));
          }
        }
      }

    } catch (error) {
      console.error('Error fetching project estimation items:', error);
      toast.error('Failed to load project estimation items');
    } finally {
      setItemsLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      room_name: '',
      category: '',
      description: '',
      unit: 'sqft',
      width: '',
      height: '',
      quantity: 1,
      unit_price: 0,
      karighar_charges_percentage: 0,
      discount_percentage: 0,
      gst_percentage: 0,
      vendor_type: ''
    }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Auto-calculate quantity for sqft unit
    if (field === 'width' || field === 'height' || field === 'unit') {
      const item = newItems[index];
      if (item.unit === 'sqft' && item.width && item.height) {
        item.quantity = parseFloat(item.width) * parseFloat(item.height);
      }
    }
    
    if (field === "category") {
      newItems[index]["karighar_charges_percentage"] = getDefaultCharges(value)
      newItems[index]["gst_percentage"] = newItems[index]["gst_percentage"].length > 0 ? newItems[index]["gst_percentage"] : bizModel.gst_percentage;
    }
    setItems(newItems);
  };

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const karigharChargesPerc = parseFloat(item.karighar_charges_percentage) || 0;
    const discountPerc = parseFloat(item.discount_percentage) || 0;
    const gstPerc = parseFloat(item.gst_percentage) || 0;

    // Step 1: Calculate subtotal
    let subtotal = 0;
    if (item.category === 'shopping_service')
      subtotal = quantity * unitPrice;
    else
      subtotal = quantity * unitPrice;

    // Step 2: Calculate karighar charges
    let karigharChargesAmount = 0;
    if (item.category === 'shopping_service')
      karigharChargesAmount = (subtotal * karigharChargesPerc) / 100;
    else
      karigharChargesAmount = subtotal * karigharChargesPerc / 100;

    // Step 3: Calculate discount
    let discountAmount = 0;
    if (item.category === 'shopping_service') {
      //discountAmount = (karigharChargesAmount * discountPerc) / 100;
      discountAmount = (subtotal * discountPerc) / 100;
    } else {
      //discountAmount = ((subtotal + karigharChargesAmount) * discountPerc) / 100;
      discountAmount = (subtotal * discountPerc) / 100;
    }

    // Step 4: Calculate amount before GST
    let amountBeforeGst = 0;
    if (item.category === 'shopping_service') {
      amountBeforeGst = karigharChargesAmount - discountAmount;
    } else {
      amountBeforeGst = subtotal + karigharChargesAmount - discountAmount;
    }

    // Step 5: Calculate GST
    const gstAmount = (amountBeforeGst * gstPerc) / 100;

    // Step 6: Final item total
    const itemTotal = amountBeforeGst + gstAmount;

    return {
      subtotal,
      karighar_charges_amount: karigharChargesAmount,
      discount_amount: discountAmount,
      amount_before_gst: amountBeforeGst,
      gst_amount: gstAmount,
      item_total: itemTotal
    };
  };

  const calculateTotals = () => {
    let woodworkSubtotal = 0;
    let woodworkTotal = 0;
    let woodworkKGCharges = 0;
    let woodworkDiscounts = 0;

    let miscInternalSubtotal = 0;
    let miscInternalTotal = 0;
    let miscInternalKGCharges = 0;
    let miscInternalDiscounts = 0;

    let miscExternalSubtotal = 0;
    let miscExternalTotal = 0;
    let miscExternalKGCharges = 0;
    let miscExternalDiscounts = 0;

    let shoppingServiceSubtotal = 0;
    let shoppingServiceTotal = 0;
    let shoppingKGCharges = 0;
    let shoppingDiscounts = 0;

    let totalGst = 0;

    items.forEach(item => {
      const itemCalc = calculateItemTotal(item);

      if (item.category === ESTIMATION_CATEGORY.WOODWORK) {
        woodworkSubtotal += itemCalc.subtotal;
        woodworkKGCharges += itemCalc.karighar_charges_amount;
        woodworkDiscounts += itemCalc.discount_amount;
        woodworkTotal += itemCalc.item_total;
      } else if (item.category === ESTIMATION_CATEGORY.MISC_INTERNAL) {
        miscInternalSubtotal += itemCalc.subtotal;
        miscInternalKGCharges += itemCalc.karighar_charges_amount;
        miscInternalDiscounts += itemCalc.discount_amount;
        miscInternalTotal += itemCalc.item_total;
      } else if (item.category === ESTIMATION_CATEGORY.MISC_EXTERNAL) {
        miscExternalSubtotal += itemCalc.subtotal;
        miscExternalKGCharges += itemCalc.karighar_charges_amount;
        miscExternalDiscounts += itemCalc.discount_amount;
        miscExternalTotal += itemCalc.item_total;
      } else if (item.category === ESTIMATION_CATEGORY.SHOPPING_SERVICE) {
        // For shopping, the subTotal is paid to vendor's directly
        shoppingServiceSubtotal = itemCalc.subtotal;
        shoppingKGCharges += itemCalc.karighar_charges_amount;
        shoppingDiscounts += itemCalc.discount_amount;
        shoppingServiceTotal += itemCalc.item_total;
      }

      totalGst += itemCalc.gst_amount;
    });



    const serviceCharge = woodworkKGCharges + miscInternalKGCharges + miscExternalKGCharges + shoppingKGCharges;
    const discount = woodworkDiscounts + miscInternalDiscounts + miscExternalDiscounts + shoppingDiscounts;
    const grandTotal = woodworkTotal + miscInternalTotal + miscExternalTotal + shoppingServiceTotal;

    return {
      woodwork_value: woodworkSubtotal,
      misc_internal_value: miscInternalSubtotal,
      misc_external_value: miscExternalSubtotal,
      shopping_service_value: shoppingServiceSubtotal,
      service_charge: serviceCharge,
      discount: discount,
      gst_amount: totalGst,
      final_value: grandTotal
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const totals = calculateTotals();

      // First, check for overpayment before creating
      const checkRes = await fetch(`/api/projects/${projectId}/check-overpayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          final_value: totals.final_value
        })
      });


      if (checkRes.ok) {
        const checkData = await checkRes.json();

        if (checkData.has_overpayment) {
          // Show modal and wait for user decision
          setOverpaymentData(checkData);

          // Prepare items with calculated values
          const itemsWithCalcs = items
            .filter(item => item.description.trim() !== '')
            .map(item => {
              const calc = calculateItemTotal(item);
              return {
                ...item,
                subtotal: calc.subtotal,
                karighar_charges_amount: calc.karighar_charges_amount,
                discount_amount: calc.discount_amount,
                amount_before_gst: calc.amount_before_gst,
                gst_amount: calc.gst_amount,
                item_total: calc.item_total
              };
            });

          setPendingSubmitData({
            project_id: projectId,
            ...totals,
            remarks: formData.remarks,
            status: formData.status,
            items: itemsWithCalcs
          });
          setShowOverpaymentModal(true);
          setSaving(false);
          return; // Stop here and wait for user action
        }
      }

      // No overpayment, proceed normally
      const itemsWithCalcs = items
        .filter(item => item.description.trim() !== '')
        .map(item => {
          const calc = calculateItemTotal(item);
          return {
            ...item,
            subtotal: calc.subtotal,
            karighar_charges_amount: calc.karighar_charges_amount,
            discount_amount: calc.discount_amount,
            amount_before_gst: calc.amount_before_gst,
            gst_amount: calc.gst_amount,
            item_total: calc.item_total
          };
        });

      await saveEstimation({
        project_id: projectId,
        ...totals,
        remarks: formData.remarks,
        status: formData.status,
        items: itemsWithCalcs
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred #123');
      setSaving(false);
    }
  };

  const saveEstimation = async (data) => {
    try {
      const res = await fetch(`/api/projects/${data.project_id}/estimations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        const responseData = await res.json();

        // // Check if overpayment was detected (shouldn't happen now, but keep for safety)
        // if (responseData.warning === 'overpayment_detected' && responseData.overpayment) {
        //   toast.warning(
        //     `⚠️ OVERPAYMENT DETECTED: ₹${responseData.overpayment.amount.toLocaleString('en-IN')}. Admin approval required.`,
        //     { duration: 8000 }
        //   );
        // } else {
        //   toast.success('Estimation saved successfully!');
        // }
        await fetchProjectData();
        router.push(`/projects/${projectId}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save estimation');
      }
    } catch (error) {
      console.error('Error saving estimation:', error);
      toast.error('An error occurred #321');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getDefaultCharges = (itemCategory) => {
    switch (itemCategory) {
      case ESTIMATION_CATEGORY.WOODWORK:
        return bizModel.design_charge_percentage;
      case ESTIMATION_CATEGORY.MISC_EXTERNAL:
      case ESTIMATION_CATEGORY.MISC_INTERNAL:
        return bizModel.service_charge_percentage;
      case ESTIMATION_CATEGORY.SHOPPING_SERVICE:
        return bizModel.shopping_charge_percentage;
      default:
        return 0;

    }
  }
  const getMaxDiscount = (index) => {
    const itemCategory = items[index].category;
    switch (itemCategory) {
      case ESTIMATION_CATEGORY.WOODWORK:
        return bizModel.max_design_charge_discount_percentage;
      case ESTIMATION_CATEGORY.MISC_INTERNAL:
      case ESTIMATION_CATEGORY.MISC_EXTERNAL:
        return bizModel.max_service_charge_discount_percentage;
      case ESTIMATION_CATEGORY.SHOPPING_SERVICE:
        return bizModel.max_shopping_charge_discount_percentage;
      default:
        return 0;
    }
  }

  if (status === 'loading' || loading || itemsLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-start justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !project) return null;

  return (
    <div className="min-h-screen bg-slate-50">
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
                          {Object.entries(ESTIMATION_CATEGORY).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {value
                                .replace('_', ' ')        // turn project_manager → project manager
                                .replace(/\b\w/g, c => c.toUpperCase())}  {/* capitalize words */}
                            </SelectItem>
                          ))}
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

                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Quantity<span className='text-red-500'>*</span></Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Unit<span className='text-red-500'>*</span></Label>
                      <Select
                        required
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
                      <Label className="text-xs">Unit Price (₹)<span className='text-red-500'>*</span></Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">KG Charges (%)<span className='text-red-500'>*</span></Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Select category for standard charges"
                        value={item.karighar_charges_percentage}
                        onChange={(e) => updateItem(index, 'karighar_charges_percentage', e.target.value)}
                        className="h-9"
                      />
                      <span className='text-xs text-amber-700 italic'>Select category for standard charges</span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Discount (%)<span className='text-red-500'>*</span></Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={item.discount_percentage}
                        onChange={(e) => updateItem(index, 'discount_percentage', e.target.value)}
                        className="h-9"
                      />
                      <span className='text-xs text-amber-700 italic'>max discount allowed is {getMaxDiscount(index)}%</span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">GST (%)<span className='text-red-500'>*</span></Label>
                      <Input
                        required
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="Enter GST%"
                        value={item.gst_percentage}
                        onChange={(e) => updateItem(index, 'gst_percentage', e.target.value)}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Vendor Type<span className='text-red-500'>*</span></Label>
                      <Select
                        required
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
                      <Label className="text-xs">Item Total</Label>
                      <Input
                        value={formatCurrency(calculateItemTotal(item).item_total)}
                        disabled
                        className="h-9 font-medium bg-green-50"
                      />
                    </div>
                  </div>

                  {/* Show breakdown for clarity */}
                  {item.category === 'shopping_service' && (
                    <div className="text-xs text-muted-foreground bg-amber-50 p-2 rounded">
                      <strong>Note:</strong> For {ESTIMATION_CATEGORY.SHOPPING_SERVICE}, customer pays {formatCurrency((item.quantity || 0) * (item.unit_price || 0))} directly to vendor. Only KG charges, discount & GST amount are considered for calculations.
                    </div>
                  )}
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
                      {Object.entries(ESTIMATION_STATUS).map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          {value
                            .replace(/\b\w/g, c => c.toUpperCase())}  {/* capitalize words */}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default GST (%)</Label>

                  <Input
                    readOnly
                    disabled
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Fetching GST% from Business Model..."
                    value={bizModel.gst_percentage || 0}
                  />


                  <span className='text-xs text-gray-500'>From the Business Model Configuration. Standard GST% added to all items.</span>
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

      {/* Overpayment Warning Modal */}
      <Dialog open={showOverpaymentModal} onOpenChange={setShowOverpaymentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl text-red-900">
                ⚠️ Overpayment Detected
              </DialogTitle>
            </div>
            <DialogDescription className="text-base">
              This estimation revision will create an overpayment situation
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 py-4">
            {overpaymentData && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700 font-medium mb-1">Total Collected (Approved)</p>
                    <p className="text-2xl font-bold text-red-900">
                      ₹{overpaymentData.total_collected?.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700 font-medium mb-1">New Estimation Total</p>
                    <p className="text-2xl font-bold text-blue-900">
                      ₹{overpaymentData.new_estimation_total?.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-900 mb-1">Overpayment Amount:</p>
                  <p className="text-3xl font-bold text-red-600">
                    ₹{overpaymentData.overpayment_amount?.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-semibold text-amber-900 mb-2">⚠️ What happens if you proceed:</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-amber-900 ml-2">
                    <li>A new estimation version (v{overpaymentData.next_version}) will be created</li>
                    {/* <li>Status will be set to <strong>Pending Admin Approval</strong></li>
                      <li>Admin must review and approve the overpayment</li> */}
                    <li>This project will be flagged in management dashboard under <strong>OverPayment Alerts</strong></li>
                    <li>System will create a credit reversal entry in payments</li>
                    <li>Finance team will upload credit note document</li>
                    <li>Ledger will reflect the adjustment</li>
                  </ol>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-blue-900 mb-2">💡 Alternative Options:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-900 ml-2">
                    <li>Cancel and revise the estimation amounts</li>
                    <li>Coordinate with Finance team before proceeding</li>
                    <li>You can cancel this version later before admin approval</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowOverpaymentModal(false);
                setOverpaymentData(null);
                setPendingSubmitData(null);
                setSaving(false);
              }}
            >
              Cancel - Don't Save
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                setShowOverpaymentModal(false);
                setSaving(true);
                await saveEstimation(pendingSubmitData);
              }}
            >
              Proceed with Overpayment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}