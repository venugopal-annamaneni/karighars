'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ManagePurchaseTable } from './components/ManagePurchaseTable';
import { AdditionalPurchasesTable } from './components/AdditionalPurchasesTable';

export default function ManagePurchasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
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
          <CardTitle>Manage Purchase Requests</CardTitle>
          <CardDescription>
            View purchase requests status for all estimation items. Use CSV upload feature (coming soon) to create or edit purchase requests in bulk.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Estimation Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estimation Items</CardTitle>
          <CardDescription>
            View current purchase requests status. Use CSV upload for bulk edits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagePurchaseTable 
            data={estimationItems}
            vendors={vendors}
          />
        </CardContent>
      </Card>

      {/* Additional Purchases */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Purchases</CardTitle>
          <CardDescription>
            Direct purchase items not linked to estimation. Use CSV upload to add or modify items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdditionalPurchasesTable 
            data={additionalPurchases}
            vendors={vendors}
          />
        </CardContent>
      </Card>
    </div>
  );
}
