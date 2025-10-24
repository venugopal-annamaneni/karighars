"use client";

import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PROJECT_STAGES } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Activity
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ProjectLedgerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const { project, loading } = useProjectData();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchProjectData();
    }
  }, [status, router, projectId]);

  const fetchProjectData = async () => {
    try {
      const [ledgerRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/ledger`),
      ]);

      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger(data.ledger);
      }
    } catch (error) {
      console.error('Error fetching project legder data:', error);
      toast.error('Failed to load project ledger data');
    } finally {
      setLedgerLoading(false);
    }
  };


  if (status === 'loading' || loading || ledgerLoading) {
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

    <Card>
      <CardHeader>
        <CardTitle>Project Ledger</CardTitle>
        <CardDescription>Complete transaction history for this project</CardDescription>
      </CardHeader>
      <CardContent>
        {ledger.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No transactions recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium capitalize">{entry.transaction_type}</p>
                    {entry.amount > 0 && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 hover:text-green-700">Inflow</Badge>
                    )}
                    {entry.amount < 0 && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 hover:text-red-700">Outflow</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(entry.entry_date)}
                    {entry.transaction_details && (() => {
                      try {
                        const details = typeof entry.transaction_details === 'string'
                          ? JSON.parse(entry.transaction_details)
                          : entry.transaction_details;
                        return <> • {details.customer_name || details.vendor_name}</>;
                      } catch (e) {
                        return null;
                      }
                    })()}
                    {entry.transaction_details?.approved_by_name && (
                      <span className="text-green-600"> • Approved by {entry.transaction_details.approved_by_name}</span>
                    )}
                  </p>
                  {entry.remarks && (
                    <p className="text-sm text-muted-foreground mt-1">{entry.remarks}</p>
                  )}
                </div>
                <div className="text-right ml-6">
                  <p className={`text-xl font-bold ${entry.amount < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                    {formatCurrency(entry.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Balance: {formatCurrency(entry.running_balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}