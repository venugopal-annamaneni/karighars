"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, IndianRupee, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function PaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customerPayments, setCustomerPayments] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      const [paymentsInRes, paymentsOutRes, projectsRes] = await Promise.all([
        fetch('/api/customer-payments'),
        fetch('/api/vendor-payments'),
        fetch('/api/projects')
      ]);

      if (paymentsInRes.ok) {
        const data = await paymentsInRes.json();
        setCustomerPayments(data.payments);
      }

      if (paymentsOutRes.ok) {
        const data = await paymentsOutRes.json();
        setVendorPayments(data.payments);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const filterPayments = (payments) => {
    if (selectedProject === 'all') return payments;
    return payments.filter(p => p.project_id === parseInt(selectedProject));
  };

  const totalReceived = customerPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalPaid = vendorPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const netPosition = totalReceived - totalPaid;

  const filteredCustomerPayments = filterPayments(customerPayments);
  const filteredVendorPayments = filterPayments(vendorPayments);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground mt-1">
              Track all financial transactions
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceived)}</div>
              <p className="text-xs text-muted-foreground mt-1">{customerPayments.length} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Total Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPaid)}</div>
              <p className="text-xs text-muted-foreground mt-1">{vendorPayments.length} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Net Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netPosition)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {netPosition >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Filter by Project:</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Tabs */}
        <Tabs defaultValue="received" className="space-y-4">
          <TabsList>
            <TabsTrigger value="received">Customer Payments</TabsTrigger>
            <TabsTrigger value="paid">Vendor Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-4">
            {filteredCustomerPayments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <IndianRupee className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No customer payments recorded</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredCustomerPayments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Link href={`/projects/${payment.project_id}`}>
                              <h3 className="font-semibold hover:underline">{payment.project_name}</h3>
                            </Link>
                            <Badge variant="outline" className="capitalize">
                              {payment.payment_type?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="grid md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div>
                              <p className="text-xs">Customer</p>
                              <p className="font-medium text-foreground">{payment.customer_name}</p>
                            </div>
                            <div>
                              <p className="text-xs">Date</p>
                              <p className="font-medium text-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(payment.payment_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs">Mode</p>
                              <p className="font-medium text-foreground capitalize">{payment.mode}</p>
                            </div>
                            <div>
                              <p className="text-xs">Reference</p>
                              <p className="font-medium text-foreground">{payment.reference_number || 'N/A'}</p>
                            </div>
                          </div>
                          {payment.remarks && (
                            <p className="text-sm text-muted-foreground mt-2">{payment.remarks}</p>
                          )}
                        </div>
                        <div className="text-right ml-6">
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(payment.amount)}
                          </div>
                          <p className="text-xs text-muted-foreground">Received</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="paid" className="space-y-4">
            {filteredVendorPayments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <IndianRupee className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No vendor payments recorded</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredVendorPayments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Link href={`/projects/${payment.project_id}`}>
                              <h3 className="font-semibold hover:underline">{payment.project_name}</h3>
                            </Link>
                            <Badge variant="outline" className="capitalize">
                              {payment.payment_stage}
                            </Badge>
                          </div>
                          <div className="grid md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div>
                              <p className="text-xs">Vendor</p>
                              <p className="font-medium text-foreground">{payment.vendor_name}</p>
                            </div>
                            <div>
                              <p className="text-xs">Date</p>
                              <p className="font-medium text-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(payment.payment_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs">Mode</p>
                              <p className="font-medium text-foreground capitalize">{payment.mode || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs">Reference</p>
                              <p className="font-medium text-foreground">{payment.reference_number || 'N/A'}</p>
                            </div>
                          </div>
                          {payment.remarks && (
                            <p className="text-sm text-muted-foreground mt-2">{payment.remarks}</p>
                          )}
                        </div>
                        <div className="text-right ml-6">
                          <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(payment.amount)}
                          </div>
                          <p className="text-xs text-muted-foreground">Paid</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Label({ children, className }) {
  return <label className={className}>{children}</label>;
}
