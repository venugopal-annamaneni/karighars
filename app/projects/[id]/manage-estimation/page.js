"use client";

import { ESTIMATION_STATUS } from '@/app/constants';
import { useProjectData } from "@/app/context/ProjectDataContext";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from 'sonner';





// Helper function for category icons (global)
const getCategoryIcon = (categoryId) => {
  const iconMap = {
    'woodwork': '🪵',
    'misc': '🔧',
    'misc_internal': '🔧',
    'misc_external': '🔨',
    'shopping': '🛒',
    'shopping_service': '🛒',
    'civil': '🏗️',
    'default': '📦'
  };
  return iconMap[categoryId?.toLowerCase()] || iconMap['default'];
};

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
  const [emptyItem, setEmptyItem] = useState({});

  const [data, setData] = useState([emptyItem]);
  const [baseRates, setbaseRates] = useState({
    gst_percentage: ''
  });

  const [formData, setFormData] = useState({
    remarks: '',
    status: ESTIMATION_STATUS.DRAFT,
  });

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

      // Load active base rate (instead of biz_model)
      const baseRateRes = await fetch(`/api/projects/${projectId}/base-rates/active`);
      if (!baseRateRes.ok) {
        throw new Error('Failed to fetch active base rates');
      }
      const baseRateData = await baseRateRes.json();
      setbaseRates(baseRateData.activeRate); // Keep same state name for compatibility

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
            setData(itemsData.items.map(item => ({
              id: item.id || Date.now() + Math.random(),
              room_name: item.room_name || '',
              category: item.category,
              item_name: item.item_name,
              unit: item.unit || 'sqft',
              width: item.width || '',
              height: item.height || '',
              quantity: parseFloat(item.quantity),
              unit_price: parseFloat(item.unit_price),
              karighar_charges_percentage: parseFloat(item.karighar_charges_percentage),
              item_discount_percentage: parseFloat(item.item_discount_percentage || 0),
              discount_kg_charges_percentage: parseFloat(item.discount_kg_charges_percentage || 0),
              gst_percentage: parseFloat(item.gst_percentage),
              vendor_type: item.vendor_type
            })));
          }
        }
      }
      setEmptyItem({
        id: Date.now(),
        room_name: '',
        category: '',
        item_name: '',
        unit: 'sqft',
        width: '',
        height: '',
        quantity: 1,
        unit_price: 0,
        karighar_charges_percentage: 0,
        item_discount_percentage: 0,
        discount_kg_charges_percentage: 0,
        gst_percentage: baseRateData.activeRate.gst_percentage,
        vendor_type: ''
      });

    } catch (error) {
      console.error('Error fetching project estimation items:', error);
      toast.error('Failed to load project estimation items');
    } finally {
      setItemsLoading(false);
    }
  };

  // Helper function to get category config from JSONB
  const getCategoryConfig = (itemCategory) => {
    if (!baseRates.category_rates || !baseRates.category_rates.categories) {
      return null;
    }

    // Direct lookup - estimation_items.category already stores the category ID
    return baseRates.category_rates.categories.find(c => c.id === itemCategory);
  };

  const getDefaultCharges = (itemCategory) => {
    const config = getCategoryConfig(itemCategory);
    return config?.kg_percentage || 0;
  };

  const getMaxItemDiscount = (itemCategory) => {
    const config = getCategoryConfig(itemCategory);
    return config?.max_item_discount_percentage || 0;
  };

  const getMaxKGDiscount = (itemCategory) => {
    const config = getCategoryConfig(itemCategory);
    return config?.max_kg_discount_percentage || 0;
  };

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const karigharChargesPerc = parseFloat(item.karighar_charges_percentage) || 0;
    const itemDiscountPerc = parseFloat(item.item_discount_percentage) || 0;
    const kgDiscountPerc = parseFloat(item.discount_kg_charges_percentage) || 0;
    const gstPerc = parseFloat(item.gst_percentage) || 0;

    // Step 1: Calculate subtotal
    const subtotal = quantity * unitPrice;

    // Step 2: Apply item discount (BEFORE KG charges)
    const itemDiscountAmount = (subtotal * itemDiscountPerc) / 100;
    const discountedSubtotal = subtotal - itemDiscountAmount;

    // Step 3: Calculate KG charges (on discounted subtotal)
    const kgChargesGross = (discountedSubtotal * karigharChargesPerc) / 100;

    // Step 4: Apply KG discount (ON KG charges only)
    const kgDiscountAmount = (kgChargesGross * kgDiscountPerc) / 100;
    const kgChargesNet = kgChargesGross - kgDiscountAmount;

    // Step 5: Calculate amount before GST (flag-based)
    const categoryConfig = getCategoryConfig(item.category);
    let amountBeforeGst = 0;
    if (categoryConfig?.pay_to_vendor_directly) {
      // Customer pays vendor directly, only KG charges billed
      amountBeforeGst = kgChargesNet;
    } else {
      // Full billing: items + KG charges
      amountBeforeGst = discountedSubtotal + kgChargesNet;
    }

    // Step 6: Calculate GST
    const gstAmount = (amountBeforeGst * gstPerc) / 100;

    // Step 7: Final item total
    const itemTotal = amountBeforeGst + gstAmount;

    return {
      subtotal,
      item_discount_amount: itemDiscountAmount,
      discounted_subtotal: discountedSubtotal,
      karighar_charges_gross: kgChargesGross,
      kg_discount_amount: kgDiscountAmount,
      karighar_charges_amount: kgChargesNet,
      amount_before_gst: amountBeforeGst,
      gst_amount: gstAmount,
      item_total: itemTotal
    };
  };

  const calculateTotals = () => {
    // Get available categories from baseRates
    const categories = baseRates.category_rates?.categories || [];

    // Initialize dynamic accumulators for each category
    const categoryAccumulators = {};
    categories.forEach(cat => {
      categoryAccumulators[cat.id] = {
        subtotal: 0,
        item_discount_amount: 0,
        kg_charges_gross: 0,
        kg_charges_discount: 0,
        amount_before_gst: 0,
        gst_amount: 0,
        total: 0
      };
    });

    // High-level totals
    let totalItemsValue = 0;
    let totalItemsDiscount = 0;
    let totalKGCharges = 0;
    let totalKGDiscount = 0;
    let totalGST = 0;
    let grandTotal = 0;

    // Accumulate dynamically for each item
    data.forEach(item => {
      const itemCalc = calculateItemTotal(item);
      const categoryId = item.category;

      // Accumulate in the appropriate category bucket
      if (categoryAccumulators[categoryId]) {
        categoryAccumulators[categoryId].subtotal += itemCalc.subtotal;
        categoryAccumulators[categoryId].item_discount_amount += itemCalc.item_discount_amount;
        categoryAccumulators[categoryId].kg_charges_gross += itemCalc.karighar_charges_gross;
        categoryAccumulators[categoryId].kg_charges_discount += itemCalc.kg_discount_amount;
        categoryAccumulators[categoryId].amount_before_gst += itemCalc.amount_before_gst;
        categoryAccumulators[categoryId].gst_amount += itemCalc.gst_amount;
        categoryAccumulators[categoryId].total += itemCalc.item_total;
      }

      // Accumulate high-level totals
      totalItemsValue += itemCalc.subtotal;
      totalItemsDiscount += itemCalc.item_discount_amount;
      totalKGCharges += itemCalc.karighar_charges_gross;
      totalKGDiscount += itemCalc.kg_discount_amount;
      totalGST += itemCalc.gst_amount;
      grandTotal += itemCalc.item_total;
    });

    return {
      category_breakdown: categoryAccumulators,
      items_value: totalItemsValue,
      items_discount: totalItemsDiscount,
      kg_charges: totalKGCharges,
      kg_charges_discount: totalKGDiscount,
      gst_amount: totalGST,
      final_value: grandTotal
    };
  };

  // Helper function for category icons
  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      'woodwork': '🪵',
      'misc': '🔧',
      'misc_internal': '🔧',
      'misc_external': '🔨',
      'shopping': '🛒',
      'shopping_service': '🛒',
      'civil': '🏗️',
      'default': '📦'
    };
    return iconMap[categoryId?.toLowerCase()] || iconMap['default'];
  };

  // Helper function to update items for a specific category
  const updateCategoryItems = useCallback((categoryId, updatedItems) => {
    setData(prevData => {
      // Remove old items from this category
      const otherCategoryItems = prevData.filter(item => item.category !== categoryId);
      // Add updated items from this category
      return [...otherCategoryItems, ...updatedItems];
    });
  }, []);


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
          const itemsWithCalcs = data
            .filter(item => item.item_name.trim() !== '')
            .map(item => {
              const calc = calculateItemTotal(item);
              return {
                ...item,
                item_name: item.item_name,
                subtotal: calc.subtotal,
                item_discount_amount: calc.item_discount_amount,
                karighar_charges_amount: calc.karighar_charges_gross,
                discount_kg_charges_amount: calc.kg_discount_amount,
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
      const itemsWithCalcs = data
        .filter(item => item.item_name.trim() !== '')
        .map(item => {
          const calc = calculateItemTotal(item);
          return {
            ...item,
            item_name: item.item_name,
            subtotal: calc.subtotal,
            item_discount_amount: calc.item_discount_amount,
            karighar_charges_amount: calc.karighar_charges_gross,
            discount_kg_charges_amount: calc.kg_discount_amount,
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

  //const totals = calculateTotals();

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
        
        {/* Overall Summary - Top */}
        <OverallSummary totals={calculateTotals()} baseRates={baseRates} />

        {/* Category-based Tables */}
        {baseRates.category_rates?.categories
          ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(category => {
            const categoryItems = data.filter(item => item.category === category.id);
            return (
              <CategoryEstimationTable
                key={category.id}
                category={category}
                items={categoryItems}
                onItemsChange={(updatedItems) => updateCategoryItems(category.id, updatedItems)}
                baseRates={baseRates}
                calculateItemTotal={calculateItemTotal}
                emptyItem={emptyItem}
              />
            );
          })}

        {/* Keyboard Shortcuts Help */}
        <Card>
          <CardContent className="pt-4">
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-900">
              <strong>⌨️ Keyboard Shortcuts:</strong>
              <span className="ml-2">Tab = Next cell</span>
              <span className="ml-2">•</span>
              <span className="ml-2">Enter = Next row</span>
              <span className="ml-2">•</span>
              <span className="ml-2">Esc = Cancel edit</span>
            </div>
          </CardContent>
        </Card>

        {/* Overall Summary - Bottom */}
        <OverallSummary totals={calculateTotals()} baseRates={baseRates} />

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
                    value={baseRates.gst_percentage || 0}
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



// ===== OVERALL SUMMARY COMPONENT =====
const OverallSummary = ({ totals, baseRates }) => {
  const categories = baseRates.category_rates?.categories || [];
  
  const getCategoryGridCols = (count) => {
    if (count <= 3) return 'md:grid-cols-3';
    if (count === 4) return 'md:grid-cols-4';
    if (count === 5 || count === 6) return 'md:grid-cols-3';
    return 'md:grid-cols-4';
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Estimation Overview</CardTitle>
        <CardDescription>Summary of all categories</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Category Breakdown */}
        <div className={`grid gap-4 ${getCategoryGridCols(categories.length)}`}>
          {categories
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(category => {
              const categoryData = totals.category_breakdown?.[category.id] || {};
              return (
                <div key={category.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-xs text-muted-foreground mb-1">{category.category_name}</p>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(categoryData.total || 0)}
                  </p>
                </div>
              );
            })}
        </div>
        
        {/* High-Level Totals */}
        <div className="grid md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-slate-300">
          <div>
            <p className="text-sm text-muted-foreground">Total Items Value</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totals.items_value || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Discount</p>
            <p className="text-xl font-bold text-red-600">
              -{formatCurrency((totals.items_discount || 0) + (totals.kg_charges_discount || 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">GST</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totals.gst_amount || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Final Value</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.final_value || 0)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


// ===== CATEGORY ESTIMATION TABLE COMPONENT =====
const CategoryEstimationTable = memo(function CategoryEstimationTable({
  category,
  items,
  onItemsChange,
  baseRates,
  calculateItemTotal,
  emptyItem
}) {
  // Calculate category totals
  const categoryTotals = useMemo(() => {
    const fields = ['subtotal', 'item_discount_amount', 'karighar_charges_amount', 
                    'discount_kg_charges_amount', 'gst_amount', 'item_total'];
    const sums = {};
    fields.forEach(field => {
      sums[field] = items.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
    });
    return sums;
  }, [items]);

  // Local handlers for this category
  const addItem = () => {
    const newItem = { 
      ...emptyItem, 
      id: Date.now() + Math.random(),
      category: category.id 
    };
    onItemsChange([...items, newItem]);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
  };

  const duplicateItem = (index) => {
    const itemToCopy = items[index];
    const duplicated = {
      ...itemToCopy,
      id: Date.now() + Math.random()
    };
    const updated = [...items];
    updated.splice(index + 1, 0, duplicated);
    onItemsChange(updated);
  };

  const updateItem = useCallback((index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    onItemsChange(updated);
  }, [items, onItemsChange]);

  // Reuse EditableEstimationItems but pass category-specific data
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>{getCategoryIcon(category.id)}</span>
              <span>{category.category_name}</span>
            </CardTitle>
            <CardDescription>
              {category.kg_label}: {category.kg_percentage}% | Max Item Disc: {category.max_item_discount_percentage}%
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
            <p className="text-muted-foreground mb-3">
              No items in {category.category_name} yet
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add First {category.category_name} Item
            </Button>
          </div>
        ) : (
          <>
            <EditableEstimationItems 
              data={items} 
              setData={onItemsChange} 
              totals={categoryTotals} 
              emptyItem={{...emptyItem, category: category.id}} 
              baseRates={baseRates} 
              calculateItemTotal={calculateItemTotal}
              showAddButton={false}
            />
            
            {/* Category Summary */}
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-3">{category.category_name} Summary</h4>
              <div className="grid md:grid-cols-6 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Subtotal</p>
                  <p className="font-bold text-green-700">
                    {category.pay_to_vendor_directly && (
                      <span className="line-through text-muted-foreground mr-2">
                        {formatCurrency(categoryTotals.subtotal || 0)}
                      </span>
                    )}
                    {!category.pay_to_vendor_directly && formatCurrency(categoryTotals.subtotal || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Item Disc.</p>
                  <p className="font-bold text-red-600">-{formatCurrency(categoryTotals.item_discount_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">KG Charges</p>
                  <p className="font-bold text-blue-600">{formatCurrency(categoryTotals.karighar_charges_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">KG Disc.</p>
                  <p className="font-bold text-red-600">-{formatCurrency(categoryTotals.discount_kg_charges_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GST</p>
                  <p className="font-bold text-slate-700">{formatCurrency(categoryTotals.gst_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-lg text-green-700">{formatCurrency(categoryTotals.item_total || 0)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});


// ✅ Drop-in Optimized EditableEstimationItems
export const EditableEstimationItems = memo(function EditableEstimationItems({
  data,
  setData,
  totals,
  emptyItem,
  baseRates,
  calculateItemTotal,
  showAddButton = true,
}) {
  const tableContainerRef = useRef(null);
  const cellRefs = useRef({});

  const [columnPinning, setColumnPinning] = useState({
    left: ["room_name", "category", "item_name"],
    right: ["item_total", "actions"],
  });

  /** 🧩 Memoized & stable update function */
  const updateItem = useCallback(
    (index, field, value) => {
      setData((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, [field]: value };

          // Auto compute sqft qty
          if (["width", "height", "unit"].includes(field)) {
            if (updated.unit === "sqft" && updated.width && updated.height) {
              updated.quantity =
                parseFloat(updated.width) * parseFloat(updated.height);
            }
          }

          // Auto populate charges on category change
          if (field === "category") {
            const cat = baseRates.category_rates?.categories?.find(
              (c) => c.id === value
            );
            updated.karighar_charges_percentage = cat?.kg_percentage || 0;
            if (!updated.gst_percentage)
              updated.gst_percentage = baseRates.gst_percentage || 0;
          }
          return updated;
        })
      );
    },
    [setData, baseRates]
  );

  /** 🧩 Stable duplicate + remove functions */
  const duplicateItem = useCallback(
    (index) => {
      setData((prev) => {
        const clone = { ...prev[index], id: Date.now() };
        toast.success("Item duplicated");
        return [
          ...prev.slice(0, index + 1),
          clone,
          ...prev.slice(index + 1),
        ];
      });
    },
    [setData]
  );

  const removeItem = useCallback(
    (index) => {
      setData((prev) => prev.filter((_, i) => i !== index));
    },
    [setData]
  );

  const addItem = useCallback(() => {
    setData((prev) => [...prev, { ...emptyItem, id: Date.now() }]);
  }, [setData, emptyItem]);

  /** 🧠 Register + focus helpers */
  function registerCellRef(table, rowIndex, columnId, ref) {
    const key = `${rowIndex}-${columnId}`;
    table.options.meta.cellRefs[key] = ref;
  }

  function focusCell(table, rowIndex, columnId, retries = 5) {
    const key = `${rowIndex}-${columnId}`;
    const ref = table.options.meta.cellRefs[key];
    if (ref?.current) {
      ref.current.focus();
      ref.current.select?.();
      ref.current.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    } else if (retries > 0) {
      queueMicrotask(() => focusCell(table, rowIndex, columnId, retries - 1));
    }
  }

  /** 🧠 Editable TextCell */
  const EditableTextCell = memo(function EditableTextCell({
    getValue,
    row,
    column,
    table,
    type = "text",
    readOnly = false,
  }) {
    const inputRef = useRef(null);
    registerCellRef(table, row.index, column.id, inputRef);
    const [value, setValue] = useState(getValue() ?? "");
    useEffect(() => setValue(getValue() ?? ""), [getValue]);

    const onBlur = () => table.options.meta.updateData(row.index, column.id, value);

    const onKeyDown = (e) => {
      const visibleCols = table.getVisibleLeafColumns();
      const idx = visibleCols.findIndex((c) => c.id === column.id);

      if (e.key === "Enter") {
        e.preventDefault();
        onBlur();
        setTimeout(() => focusCell(table, row.index + 1, column.id), 0);
      } else if (e.key === "Tab") {
        e.preventDefault();
        onBlur();
        const next = visibleCols[idx + (e.shiftKey ? -1 : 1)];
        if (next) focusCell(table, row.index, next.id);
        else focusCell(table, row.index + 1, visibleCols[0].id);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        focusCell(table, row.index + 1, column.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusCell(table, row.index - 1, column.id);
      } else if (e.key === "Escape") {
        setValue(getValue() ?? "");
        inputRef.current?.blur();
      }
    };

    return (
      <Input
        ref={inputRef}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`h-8 text-sm ${readOnly
          ? "bg-gray-100 text-gray-400 border-gray-200"
          : "border-gray-300"
          } ${type === 'number' ? "text-right" : "text-left"}`}
      />
    );
  });

  const EditableNumberCell = (props) => (
    <EditableTextCell {...props} type="number" />
  );

  const EditableSelectCell = memo(function EditableSelectCell({
    getValue,
    row,
    column,
    table,
    options,
  }) {
    const selectRef = useRef(null);
    registerCellRef(table, row.index, column.id, selectRef);
    return (
      <Select
        value={getValue()}
        onValueChange={(value) =>
          table.options.meta.updateData(row.index, column.id, value)
        }
      >
        <SelectTrigger ref={selectRef} className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  });

  /** ⚙️ Columns — memoized */
  const columns = useMemo(() => {
    const catOptions =
      baseRates.category_rates?.categories?.map((cat) => ({
        value: cat.id,
        label: cat.category_name,
      })) || [];

    return [
      { accessorKey: "room_name", header: "Room/Section", size: 150, cell: EditableTextCell },
      {
        accessorKey: "category",
        header: "Category",
        size: 130,
        cell: (ctx) => (
          <EditableSelectCell
            {...ctx}
            options={catOptions.sort(
              (a, b) =>
                (baseRates.category_rates?.categories.find((c) => c.id === a.value)?.sort_order ||
                  0) -
                (baseRates.category_rates?.categories.find((c) => c.id === b.value)?.sort_order ||
                  0)
            )}
          />
        ),
      },
      { accessorKey: "item_name", header: "Item Name", size: 180, cell: EditableTextCell },
      {
        accessorKey: "unit",
        header: "Unit",
        size: 100,
        cell: (ctx) => (
          <EditableSelectCell
            {...ctx}
            options={[
              { value: "sqft", label: "Sq.ft" },
              { value: "no", label: "No" },
              { value: "lumpsum", label: "Lumpsum" },
            ]}
          />
        ),
      },
      { accessorKey: "width", header: "Width", size: 90, cell: (ctx) => <EditableNumberCell {...ctx} readOnly={ctx.row.original.unit !== "sqft"} /> },
      { accessorKey: "height", header: "Height", size: 90, cell: (ctx) => <EditableNumberCell {...ctx} readOnly={ctx.row.original.unit !== "sqft"} /> },
      { accessorKey: "quantity", header: "Qty", size: 100, cell: (ctx) => <EditableNumberCell {...ctx} readOnly={ctx.row.original.unit === "sqft"} /> },
      { accessorKey: "unit_price", header: "Unit Price (₹)", size: 120, cell: EditableNumberCell },
      {
        accessorKey: "item_discount_percentage", header: "Item Disc (%)", size: 110, cell: (ctx) => {
          const thisCategory = baseRates.category_rates.categories.find((cat) => cat.id === ctx.row.original.category)
          return <EditableNumberCell {...ctx} readOnly={thisCategory.pay_to_vendor_directly}/>
        }
      },
      { accessorKey: "karighar_charges_percentage", header: "KG Charges (%)", size: 120, cell: EditableNumberCell },
      { accessorKey: "discount_kg_charges_percentage", header: "KG Disc (%)", size: 110, cell: EditableNumberCell },
      { accessorKey: "gst_percentage", header: "GST (%)", size: 90, cell: EditableNumberCell },
      {
        accessorKey: "vendor_type",
        header: "Vendor",
        size: 100,
        cell: (ctx) => (
          <EditableSelectCell
            {...ctx}
            options={[
              { value: "PI", label: "PI" },
              { value: "Aristo", label: "Aristo" },
              { value: "Other", label: "Other" },
            ]}
          />
        ),
      },
      {
        id: "item_total",
        header: "Item Total",
        size: 120,
        cell: ({ row }) => {
          const total = useMemo(
            () => calculateItemTotal(row.original).item_total,
            [row.original, calculateItemTotal]
          );
          return (
            <div className="font-medium text-green-700 text-sm">
              {formatCurrency(total)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1 justify-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => duplicateItem(row.index)}
              title="Duplicate"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeItem(row.index)}
              className="text-red-600 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
    ];
  }, [baseRates, calculateItemTotal, duplicateItem, removeItem]);

  /** ⚡ Table Instance */
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { columnPinning },
    onColumnPinningChange: setColumnPinning,
    meta: { updateData: updateItem, cellRefs: cellRefs.current },
  });

  /** 🌀 Virtualized Rows (middle section) */
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  /** Scroll sync left/middle/right */
  useEffect(() => {
    const left = document.getElementById("left-fixed");
    const right = document.getElementById("right-fixed");
    const middle = document.getElementById("middle-scroll");
    if (!left || !right || !middle) return;
    const sync = () => {
      left.scrollTop = middle.scrollTop;
      right.scrollTop = middle.scrollTop;
    };
    middle.addEventListener("scroll", sync);
    return () => middle.removeEventListener("scroll", sync);
  }, []);

  /** 🧩 Render */
  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-3 mb-2">
        <div className="text-sm text-muted-foreground">
          Total Items: {data.length}
        </div>
        {showAddButton && (
          <Button type="button" onClick={addItem} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        )}
      </div>

      <div className="flex w-full border rounded-lg" style={{ maxHeight: "600px" }}>
        {/* LEFT FIXED */}
        <div id="left-fixed" className="flex-none w-[465px] border-r overflow-hidden" style={{ overflowY: "auto" }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-100 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers
                    .filter((h) => ["room_name", "category", "item_name"].includes(h.column.id))
                    .map((header) => (
                      <th key={header.id} className="p-2 border-b font-semibold" width="155px">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <tr
                    key={row.id}
                    className="bg-white border-b"
                    style={{ position: "absolute", top: 0, transform: `translateY(${vr.start}px)` }}
                  >
                    {row
                      .getVisibleCells()
                      .filter((c) => ["room_name", "category", "item_name"].includes(c.column.id))
                      .map((cell) => (
                        <td key={cell.id} className="p-2 border-r" width="155px">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* MIDDLE SCROLL */}
        <div ref={tableContainerRef} id="middle-scroll" className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="sticky top-0 bg-slate-100 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers
                    .filter(
                      (h) =>
                        !["room_name", "category", "item_name", "item_total", "actions"].includes(h.column.id)
                    )
                    .map((header) => (
                      <th key={header.id} className="p-2 border-b font-semibold whitespace-nowrap w-[120px]">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <tr
                    key={row.id}
                    style={{ position: "absolute", top: 0, transform: `translateY(${vr.start}px)` }}
                    className="border-b bg-white"
                  >
                    {row
                      .getVisibleCells()
                      .filter(
                        (c) =>
                          !["room_name", "category", "item_name", "item_total", "actions"].includes(c.column.id)
                      )
                      .map((cell) => (
                        <td key={cell.id} className="p-2 border-r w-[120px]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT FIXED */}
        <div id="right-fixed" className="flex-none w-[210px] border-l overflow-hidden" style={{ overflowY: "auto" }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-100 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers
                    .filter((h) => ["item_total", "actions"].includes(h.column.id))
                    .map((header) => (
                      <th key={header.id} className="p-2 border-b font-semibold" width="105px" >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <tr
                    key={row.id}
                    className="border-b bg-white"
                    style={{ position: "absolute", top: 0, transform: `translateY(${vr.start}px)` }}
                  >
                    {row
                      .getVisibleCells()
                      .filter((c) => ["item_total", "actions"].includes(c.column.id))
                      .map((cell) => (
                        <td key={cell.id} className="p-2 border-r text-right" width="105px">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});


const EstimationSummary = ({ totals, baseRates }) => {
  // Get categories from baseRates (available in parent scope)
  const categories = baseRates.category_rates?.categories || [];

  // Helper to get grid columns based on category count
  const getCategoryGridCols = (count) => {
    // if (count <= 3) return 'md:grid-cols-3';
    // if (count === 4) return 'md:grid-cols-4';
    // if (count === 5 || count === 6) return 'md:grid-cols-3';
    return 'md:grid-cols-4'; // 4xN grid for 7+
  };

  return (
    <div className="mt-6 p-4 bg-slate-50 rounded-lg">
      <h3 className="font-semibold mb-3">Estimation Summary</h3>

      {/* Dynamic Category Breakdown */}
      <div className={`grid gap-4 text-sm ${getCategoryGridCols(categories.length)}`}>
        {categories
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(category => {
            const categoryData = totals.category_breakdown?.[category.id] || {};
            return (
              <div key={category.id}>
                <p className="text-muted-foreground">{category.category_name} Value</p>
                <p className="font-bold text-lg">
                  {formatCurrency(categoryData.subtotal || 0)}
                </p>
              </div>
            );
          })}
      </div>

      {/* High-level Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-slate-300">
        <div>
          <p className="text-muted-foreground">Discount</p>
          <p className="font-bold text-xl text-green-700">
            {formatCurrency(totals.items_discount + totals.kg_charges_discount)}
          </p>
          <p className="font-base text-xs text-blue-700">
            <span>{formatCurrency(totals.items_discount)} &amp; {formatCurrency(totals.kg_charges_discount)}</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">KG Charges %</p>
          <p className="font-bold text-xl text-green-700">
            {formatCurrency(totals.kg_charges)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">GST Amount</p>
          <p className="font-bold text-xl text-green-700">
            {formatCurrency(totals.gst_amount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Final Value</p>
          <p className="font-bold text-xl text-green-700">
            {formatCurrency(totals.final_value)}
          </p>
        </div>
      </div>
    </div>
  )
}