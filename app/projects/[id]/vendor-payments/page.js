"use client";
import { useProjectData } from '@/app/context/ProjectDataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  IndianRupee
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ProjectVendorPaymentsPage() {

  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  
  const [vendorPayments, setVendorPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
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
      const [vendorPaymentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/vendor-payments`),
      ]);
      
      if (vendorPaymentsRes.ok) {
        const data = await vendorPaymentsRes.json();
        setVendorPayments(data.payments);
      }
    } catch (error) {
      console.error('Error fetching vendor payments:', error);
      toast.error('Failed to load vendor payments data');
    } finally {
      setPaymentsLoading(false);
    }
  };

  if (status === 'loading' || loading) {
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
      <CardTitle>Vendor Payments</CardTitle>
      <CardDescription>Money paid to vendors</CardDescription>
    </CardHeader>
    <CardContent>
      {vendorPayments.length === 0 ? (
        <div className="text-center py-12">
          <IndianRupee className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No vendor payments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendorPayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{payment.vendor_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(payment.payment_date)} • {payment.payment_stage} • {payment.reference_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-red-600">{formatCurrency(payment.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
}