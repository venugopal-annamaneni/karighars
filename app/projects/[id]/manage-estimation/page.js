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
import { calculateCategoryTotals, calculateItemTotal as calculateItemTotalLib } from '@/lib/calcUtils';
import { formatCurrency } from '@/lib/utils';

import { AlertTriangle, Plus, Save } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { toast } from 'sonner';
import { EditableEstimationItems } from './components/EditableEstimationItems';


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
  const [emptyItem, setEmptyItem] = useState({
    id: Date.now(),
    room_name: '',
    category: '',
    item_name: '',
    unit: 'sqft',
    width: '',
    height: '',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
    karighar_charges_percentage: 0,
    karighar_charges_amount: 0,
    item_discount_percentage: 0,
    item_discount_amount: 0,
    discount_kg_charges_percentage: 0,
    discount_kg_charges_amount: 0,
    gst_percentage: 0,
    gst_amount: 0,
    item_total: 0,
    vendor_type: ''
  });

  const [data, setData] = useState([]);
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
              subtotal: parseFloat(item.subtotal) || 0,
              karighar_charges_percentage: parseFloat(item.karighar_charges_percentage),
              karighar_charges_amount: parseFloat(item.karighar_charges_amount) || 0,
              item_discount_percentage: parseFloat(item.item_discount_percentage || 0),
              item_discount_amount: parseFloat(item.item_discount_amount) || 0,
              discount_kg_charges_percentage: parseFloat(item.discount_kg_charges_percentage || 0),
              discount_kg_charges_amount: parseFloat(item.discount_kg_charges_amount) || 0,
              gst_percentage: parseFloat(item.gst_percentage),
              gst_amount: parseFloat(item.gst_amount) || 0,
              item_total: parseFloat(item.item_total) || 0,
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

  // Use the common calculation function with baseRates context
  const calculateItemTotal = useCallback((item) => {
    const emptyTotals = {
      subtotal: 0,
      karighar_charges_amount: 0,
      item_discount_amount: 0,
      discount_kg_charges_amount: 0,
      amount_before_gst: 0,
      gst_amount: 0,
      item_total: 0
    }
    if (baseRates && item) {
      try {
        console.log(item);
        return calculateItemTotalLib(item, baseRates);
      } catch (error) {
        toast("Item total Calculation Error. Contact Admin for tech support");
        return emptyTotals;
      }
    }
    return emptyTotals;

  }, [baseRates]);

  // Use the common calculation function
  const calculateTotals = useCallback(() => {
    // Get available categories from baseRates
    const categories = baseRates.category_rates?.categories || [];

    // Calculate item totals first
    const itemsWithTotals = data.map(item => ({
      ...item,
      ...calculateItemTotal(item)
    }));

    // Use common function for category totals
    return calculateCategoryTotals(itemsWithTotals, categories);
  }, [data, baseRates, calculateItemTotal]);

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
                karighar_charges_amount: calc.karighar_charges_amount,
                item_discount_amount: calc.item_discount_amount,
                discount_kg_charges_amount: calc.discount_kg_charges_amount,
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
            karighar_charges_amount: calc.karighar_charges_amount,
            item_discount_amount: calc.item_discount_amount,
            discount_kg_charges_amount: calc.discount_kg_charges_amount,
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
    const sums = {
      subtotal: 0,
      item_discount_amount: 0,
      karighar_charges_amount: 0,
      discount_kg_charges_amount: 0,
      gst_amount: 0,
      item_total: 0,
    };

    // derive totals using calculateItemTotal(item) so we always compute from inputs
    for (const item of items) {
      const calc = calculateItemTotal(item);
      sums.subtotal += calc.subtotal || 0;
      sums.item_discount_amount += calc.item_discount_amount || 0;
      sums.karighar_charges_amount += calc.karighar_charges_amount || 0;
      sums.discount_kg_charges_amount += calc.discount_kg_charges_amount || 0;
      sums.gst_amount += calc.gst_amount || 0;
      sums.item_total += calc.item_total || 0;
    }
    return sums;
  }, [items]);

  // Local handlers for this category
  // Set Category ID and other category specific data to EmptyItem
  const addItem = () => {
    const newItem = {
      ...emptyItem,
      id: Date.now() + Math.random(),
      category: category.id,
      karighar_charges_percentage: category.kg_percentage,
      //max_kg_discount_percentage: category.max_kg_discount_percentage;
      gst_percentage: baseRates.gst_percentage
    };
    onItemsChange([...items, newItem]);
  };

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
          <div className='space-y-4'>
            <EditableEstimationItems
              data={items}
              // Accept both updater-function or direct array and forward a real array to onItemsChange
              setData={(updaterOrArray) => {
                const next = typeof updaterOrArray === 'function' ? updaterOrArray(items) : updaterOrArray;
                onItemsChange(Array.isArray(next) ? next : items); // safety: ensure array
              }}
              baseRates={baseRates}
              calculateItemTotal={calculateItemTotal}
            />

            
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

            {/* Category Summary */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
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

          </div>
        )}
      </CardContent>
    </Card>
  );
});