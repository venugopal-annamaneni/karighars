"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Printer, TrendingUp, TrendingDown, IndianRupee } from 'lucide-react';

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState(null);
  const [selectedProject, setSelectedProject] = useState('all');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchData();
    }
  }, [status, router]);

  useEffect(() => {
    generateReport();
  }, [selectedProject, projects]);

  const fetchData = async () => {
    try {
      const [projectsRes, statsRes, paymentsInRes, paymentsOutRes] = await Promise.all([
        fetch('/api/projects?page_no=1&page_size=10&filter=""'),
        fetch('/api/dashboard?output=stats'),
        fetch('/api/all-payments?type=customer'),
        fetch('/api/all-payments?type=vendor')
      ]);


      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects);
      }

      if (statsRes.ok && paymentsInRes.ok && paymentsOutRes.ok) {
        const stats = await statsRes.json();
        const paymentsIn = await paymentsInRes.json();
        const paymentsOut = await paymentsOutRes.json();

        setReportData({
          stats: stats.stats,
          paymentsIn: paymentsIn.payments,
          paymentsOut: paymentsOut.payments
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    debugger;
    if (!reportData) return;

    let filteredPaymentsIn = reportData.paymentsIn;
    let filteredPaymentsOut = reportData.paymentsOut;

    if (selectedProject !== 'all') {
      const projectId = parseInt(selectedProject);
      filteredPaymentsIn = reportData.paymentsIn.filter(p => p.project_id === projectId);
      filteredPaymentsOut = reportData.paymentsOut.filter(p => p.project_id === projectId);
    }

    const totalIn = filteredPaymentsIn.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalOut = filteredPaymentsOut.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    setReportData({
      ...reportData,
      filteredPaymentsIn,
      filteredPaymentsOut,
      totalIn,
      totalOut,
      netPosition: totalIn - totalOut
    });
  };

  const exportToCSV = (type) => {
    if (!reportData) return;

    let data = [];
    let headers = [];
    let filename = '';

    if (type === 'payments_in') {
      headers = ['Date', 'Project', 'Customer', 'Type', 'Amount', 'Mode', 'Reference'];
      data = reportData.filteredPaymentsIn.map(p => [
        new Date(p.payment_date).toLocaleDateString('en-IN'),
        p.project_name,
        p.customer_name,
        p.payment_type,
        p.amount,
        p.mode,
        p.reference_number || ''
      ]);
      filename = `customer_payments_${Date.now()}.csv`;
    } else if (type === 'payments_out') {
      headers = ['Date', 'Project', 'Vendor', 'Stage', 'Amount', 'Mode', 'Reference'];
      data = reportData.filteredPaymentsOut.map(p => [
        new Date(p.payment_date).toLocaleDateString('en-IN'),
        p.project_name,
        p.vendor_name,
        p.payment_stage,
        p.amount,
        p.mode || '',
        p.reference_number || ''
      ]);
      filename = `vendor_payments_${Date.now()}.csv`;
    } else if (type === 'summary') {
      headers = ['Metric', 'Value'];
      data = [
        ['Total Received', reportData.totalIn],
        ['Total Paid', reportData.totalOut],
        ['Net Position', reportData.netPosition],
        ['Active Projects', reportData.stats.active_projects],
        ['Total Project Value', reportData.stats.total_project_value]
      ];
      filename = `financial_summary_${Date.now()}.csv`;
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
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

  if (!session || !reportData) return null;

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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive financial analysis and exports
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Project Filter:</Label>
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
              <div className="text-2xl font-bold text-green-600">{formatCurrency(reportData.totalIn)}</div>
              <p className="text-xs text-muted-foreground mt-1">{reportData.filteredPaymentsIn?.length} transactions</p>
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
              <div className="text-2xl font-bold text-red-600">{formatCurrency(reportData.totalOut)}</div>
              <p className="text-xs text-muted-foreground mt-1">{reportData.filteredPaymentsOut?.length} transactions</p>
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
              <div className={`text-2xl font-bold ${reportData.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(reportData.netPosition)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {reportData.netPosition >= 0 ? 'Positive' : 'Negative'} cash flow
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="print:hidden">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="payments_in">Customer Payments</TabsTrigger>
            <TabsTrigger value="payments_out">Vendor Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Financial Summary Report</CardTitle>
                    <CardDescription>
                      Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </div>
                  <Button onClick={() => exportToCSV('summary')} size="sm" className="gap-2 print:hidden">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4">Overall Statistics</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Active Projects</p>
                        <p className="text-2xl font-bold">{reportData.stats.active_projects}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Total Project Value</p>
                        <p className="text-2xl font-bold">{formatCurrency(reportData.stats.total_project_value)}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Collection Rate</p>
                        <p className="text-2xl font-bold">
                          {reportData.stats.total_project_value > 0
                            ? ((reportData.totalIn / reportData.stats.total_project_value) * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Profit Margin</p>
                        <p className="text-2xl font-bold">
                          {reportData.totalIn > 0
                            ? ((reportData.netPosition / reportData.totalIn) * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Cash Flow Summary</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-3">Category</th>
                            <th className="text-right p-3">Amount</th>
                            <th className="text-right p-3">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="p-3">Customer Payments Received</td>
                            <td className="text-right p-3 text-green-600 font-medium">{formatCurrency(reportData.totalIn)}</td>
                            <td className="text-right p-3">100%</td>
                          </tr>
                          <tr>
                            <td className="p-3">Vendor Payments Made</td>
                            <td className="text-right p-3 text-red-600 font-medium">{formatCurrency(reportData.totalOut)}</td>
                            <td className="text-right p-3">
                              {reportData.totalIn > 0 ? ((reportData.totalOut / reportData.totalIn) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                          <tr className="bg-slate-50 font-bold">
                            <td className="p-3">Net Position</td>
                            <td className={`text-right p-3 ${reportData.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(reportData.netPosition)}
                            </td>
                            <td className="text-right p-3">
                              {reportData.totalIn > 0 ? ((reportData.netPosition / reportData.totalIn) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments_in" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Customer Payments Report</CardTitle>
                    <CardDescription>All payments received from customers</CardDescription>
                  </div>
                  <Button onClick={() => exportToCSV('payments_in')} size="sm" className="gap-2 print:hidden">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  {!reportData.filteredPaymentsIn && (
                    <div className='text-center p-4 text-muted-foreground'>No customer payments yet.</div>
                  )}
                  {reportData.filteredPaymentsIn && (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Project</th>
                          <th className="text-left p-3">Customer</th>
                          <th className="text-left p-3">Type</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {reportData.filteredPaymentsIn.map((payment) => (
                          <tr key={payment.id}>
                            <td className="p-3">{formatDate(payment.payment_date)}</td>
                            <td className="p-3">{payment.project_name}</td>
                            <td className="p-3">{payment.customer_name}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize">
                                {payment.payment_type?.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="text-right p-3 font-medium text-green-600">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="p-3 capitalize">{payment.mode}</td>
                          </tr>
                        ))}

                        <tr className="bg-slate-50 font-bold">
                          <td colSpan="4" className="p-3 text-right">Total:</td>
                          <td className="text-right p-3 text-green-600">{formatCurrency(reportData.totalIn)}</td>
                          <td></td>
                        </tr>

                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments_out" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Vendor Payments Report</CardTitle>
                    <CardDescription>All payments made to vendors</CardDescription>
                  </div>
                  <Button onClick={() => exportToCSV('payments_out')} size="sm" className="gap-2 print:hidden">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  {!reportData.filteredPaymentsIn && (
                    <div className='text-center p-4 text-muted-foreground'>No customer payments yet.</div>
                  )}
                  {reportData.filteredPaymentsOut && (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Project</th>
                          <th className="text-left p-3">Vendor</th>
                          <th className="text-left p-3">Stage</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {!reportData.filteredPaymentsOut && (
                          <span className='text-muted-foreground'>No data to show</span>
                        )}
                        {reportData.filteredPaymentsOut.map((payment) => (
                          <tr key={payment.id}>
                            <td className="p-3">{formatDate(payment.payment_date)}</td>
                            <td className="p-3">{payment.project_name}</td>
                            <td className="p-3">{payment.vendor_name}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize">
                                {payment.payment_stage}
                              </Badge>
                            </td>
                            <td className="text-right p-3 font-medium text-red-600">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="p-3">{payment.reference_number || '-'}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td colSpan="4" className="p-3 text-right">Total:</td>
                          <td className="text-right p-3 text-red-600">{formatCurrency(reportData.totalOut)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <style jsx global>{`
        @media print {
          .print\:hidden {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
