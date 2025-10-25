"use client";
import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  Package,
  Plus
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ProjectVendorBOQsPage() {

  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  
  const [vendorBOQs, setVendorBOQs] = useState([]);
  const [boqsLoading, setBoqsLoading] = useState(true);
  const { project, loading } = useProjectData();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchCustomerPaymentData();
    }
  }, [status, router, projectId]);

  const fetchCustomerPaymentData = async () => {
    try {
      const [boqsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/vendor-boqs`),
      ]);

      if (boqsRes.ok) {
        const data = await boqsRes.json();
        setVendorBOQs(data.boqs);
      }
    } catch (error) {
      console.error('Error fetching project boqs data:', error);
      toast.error('Failed to load project boqs data');
    } finally {
      setBoqsLoading(false);
    }
  };

  if (status === 'loading' || loading || boqsLoading) {
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

  return <Card>
    <CardHeader>
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Vendor BOQs</CardTitle>
          <CardDescription>Bill of quantities from vendors</CardDescription>
        </div>
        <Link href={`/projects/${projectId}/boq/new`}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create BOQ
          </Button>
        </Link>
      </div>
    </CardHeader>
    <CardContent>
      {vendorBOQs.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No BOQs created yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendorBOQs.map((boq) => (
            <div key={boq.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{boq.vendor_name}</p>
                <p className="text-sm text-muted-foreground">
                  {boq.boq_code} • Margin: {boq.margin_percentage}%
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xl font-bold">{formatCurrency(boq.total_value)}</p>
                  <Badge className={`text-xs ${boq.status === 'draft' ? 'bg-slate-100 text-slate-700' :
                    boq.status === 'approved' ? 'bg-green-100 text-green-700' :
                      boq.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                    {boq.status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
}