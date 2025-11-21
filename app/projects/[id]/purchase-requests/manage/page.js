'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Loader2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ManagePurchaseTable } from './components/ManagePurchaseTable';
import { AdditionalPurchasesTable } from './components/AdditionalPurchasesTable';

export default function ManagePurchasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimationId, setEstimationId] = useState(null);
  const [estimationItems, setEstimationItems] = useState([]);
  const [additionalPurchases, setAdditionalPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Load data
  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/manage-purchase`);
      
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to load data');
        return;
      }

      const data = await res.json();
      setEstimationId(data.estimation_id);
      setEstimationItems(data.estimation_items);
      setAdditionalPurchases(data.additional_purchases || []);
      setVendors(data.vendors || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading purchase request data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate: At least one item should have fulfillment mode
      const hasSelectedItems = estimationItems.some(item => 
        item.fulfillmentMode && item.fulfillmentMode !== 'none'
      );

      if (!hasSelectedItems && additionalPurchases.length === 0) {
        toast.error('Please select at least one item to purchase');
        return;
      }

      // Validate: All selected items have required fields
      const errors = [];
      
      estimationItems.forEach((item, idx) => {
        if (item.fulfillmentMode === 'full') {
          if (!item.vendor_id) errors.push(`Row ${idx + 1}: Please select vendor`);
          if (!item.unit_price) errors.push(`Row ${idx + 1}: Please enter unit price`);
          if (!item.quantity || item.quantity <= 0) errors.push(`Row ${idx + 1}: Please enter quantity`);
        }
        
        if (item.fulfillmentMode === 'component') {
          if (!item.components || item.components.length === 0) {
            errors.push(`Row ${idx + 1}: Please add components`);
          } else {
            const totalWeightage = item.components.reduce((sum, c) => sum + (parseFloat(c.weightage) || 0), 0);
            if (Math.abs(totalWeightage - 1.0) > 0.001) {
              errors.push(`Row ${idx + 1}: Component weightage must equal 100% (currently ${(totalWeightage * 100).toFixed(1)}%)`);
            }
            
            item.components.forEach((comp, cIdx) => {
              if (!comp.vendor_id) errors.push(`Row ${idx + 1}, Component ${cIdx + 1}: Please select vendor`);
              if (!comp.name) errors.push(`Row ${idx + 1}, Component ${cIdx + 1}: Please enter component name`);
              if (!comp.unit_price) errors.push(`Row ${idx + 1}, Component ${cIdx + 1}: Please enter unit price`);
              if (!comp.quantity || comp.quantity <= 0) errors.push(`Row ${idx + 1}, Component ${cIdx + 1}: Please enter quantity`);
              if (!comp.weightage || comp.weightage <= 0) errors.push(`Row ${idx + 1}, Component ${cIdx + 1}: Please enter weightage`);
            });
          }
        }
      });

      additionalPurchases.forEach((item, idx) => {
        if (!item.vendor_id) errors.push(`Additional Purchase ${idx + 1}: Please select vendor`);
        if (!item.name) errors.push(`Additional Purchase ${idx + 1}: Please enter item name`);
        if (!item.unit_price) errors.push(`Additional Purchase ${idx + 1}: Please enter unit price`);
        if (!item.quantity || item.quantity <= 0) errors.push(`Additional Purchase ${idx + 1}: Please enter quantity`);
      });

      if (errors.length > 0) {
        errors.forEach(err => toast.error(err, { duration: 5000 }));
        return;
      }

      // Prepare data for API
      const payload = {
        estimation_id: estimationId,
        items: estimationItems
          .filter(item => item.fulfillmentMode && item.fulfillmentMode !== 'none')
          .map(item => ({
            stable_estimation_item_id: item.stable_estimation_item_id,
            item_name: item.item_name,
            category: item.category,
            room_name: item.room_name,
            unit: item.unit,
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            fulfillmentMode: item.fulfillmentMode,
            vendor_id: item.vendor_id,
            unit_price: item.unit_price,
            gst_percentage: item.gst_percentage || 18,
            components: item.components || []
          })),
        additional_purchases: additionalPurchases.map(item => ({
          name: item.name,
          unit: item.unit,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          vendor_id: item.vendor_id,
          unit_price: item.unit_price,
          gst_percentage: item.gst_percentage || 18
        }))
      };

      const res = await fetch(`/api/projects/${projectId}/purchase-requests/manage-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.details && Array.isArray(result.details)) {
          result.details.forEach(detail => {
            toast.error(detail, { duration: 6000 });
          });
        } else {
          toast.error(result.error || 'Failed to save purchase requests');
        }
        return;
      }

      toast.success(result.message || 'Purchase requests saved successfully');
      
      // Reload data
      await loadData();
      
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error saving purchase requests');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdditionalPurchase = () => {
    setAdditionalPurchases(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: '',
        unit: 'pcs',
        width: null,
        height: null,
        quantity: 1,
        vendor_id: null,
        unit_price: 0,
        gst_percentage: 18
      }
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Manage Purchase Requests</CardTitle>
              <CardDescription>
                Select items to purchase and assign vendors. Items will be grouped by vendor.
              </CardDescription>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save All PRs
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Estimation Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estimation Items</CardTitle>
          <CardDescription>
            Select fulfillment mode for each item and assign vendors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagePurchaseTable 
            data={estimationItems}
            setData={setEstimationItems}
            vendors={vendors}
          />
        </CardContent>
      </Card>

      {/* Additional Purchases */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Additional Purchases</CardTitle>
              <CardDescription>
                Items not linked to estimation (direct purchases)
              </CardDescription>
            </div>
            <Button 
              onClick={handleAddAdditionalPurchase}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AdditionalPurchasesTable 
            data={additionalPurchases}
            setData={setAdditionalPurchases}
            vendors={vendors}
          />
        </CardContent>
      </Card>
    </div>
  );
}
