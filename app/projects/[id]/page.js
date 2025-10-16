"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Edit, 
  Plus, 
  IndianRupee, 
  TrendingUp, 
  TrendingDown,
  FileText,
  Package,
  Calendar,
  Users,
  MapPin,
  Activity
} from 'lucide-react';

export default function ProjectDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  
  const [project, setProject] = useState(null);
  const [estimation, setEstimation] = useState(null);
  const [estimationItems, setEstimationItems] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [vendorBOQs, setVendorBOQs] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPhaseDialog, setShowPhaseDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showEstimationDialog, setShowEstimationDialog] = useState(false);
  const [milestones, setMilestones] = useState([]);
  
  const [phaseUpdate, setPhaseUpdate] = useState({ phase: '', remarks: '' });
  const [paymentData, setPaymentData] = useState({
    milestone_id: '',
    payment_type: 'advance_10',
    amount: '',
    mode: 'bank',
    reference_number: '',
    remarks: '',
    override_reason: ''
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchProjectData();
    }
  }, [status, router, projectId]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, paymentsRes, vendorPaymentsRes, boqsRes, ledgerRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/customer-payments?project_id=${projectId}`),
        fetch(`/api/vendor-payments?project_id=${projectId}`),
        fetch(`/api/vendor-boqs?project_id=${projectId}`),
        fetch(`/api/projects/${projectId}/ledger`)
      ]);

      if (projectRes.ok) {
        const data = await projectRes.json();
        setProject(data.project);
        setEstimation(data.estimation);
        
        if (data.estimation) {
          const itemsRes = await fetch(`/api/estimation-items/${data.estimation.id}`);
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            setEstimationItems(itemsData.items);
          }
        }
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setCustomerPayments(data.payments);
      }

      if (vendorPaymentsRes.ok) {
        const data = await vendorPaymentsRes.json();
        setVendorPayments(data.payments);
      }

      if (boqsRes.ok) {
        const data = await boqsRes.json();
        setVendorBOQs(data.boqs);
      }

      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger(data.ledger);
      }

      // Fetch milestones if project has bizModel
      if (data.project && data.project.biz_model_id) {
        const milestonesRes = await fetch(`/api/biz-models/${data.project.biz_model_id}`);
        if (milestonesRes.ok) {
          const bizData = await milestonesRes.json();
          setMilestones(bizData.milestones.filter(m => m.direction === 'inflow'));
        }
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phaseUpdate)
      });

      if (res.ok) {
        toast.success('Project phase updated');
        setShowPhaseDialog(false);
        fetchProjectData();
      } else {
        toast.error('Failed to update phase');
      }
    } catch (error) {
      console.error('Error updating phase:', error);
      toast.error('An error occurred');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customer-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          customer_id: project.customer_id,
          estimation_id: estimation?.id,
          milestone_id: paymentData.milestone_id || null,
          ...paymentData
        })
      });

      if (res.ok) {
        toast.success('Payment recorded successfully');
        setShowPaymentDialog(false);
        setPaymentData({
          milestone_id: '',
          payment_type: 'advance_10',
          amount: '',
          mode: 'bank',
          reference_number: '',
          remarks: '',
          override_reason: ''
        });
        fetchProjectData();
      } else {
        toast.error('Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('An error occurred');
    }
  };

  const handleMilestoneChange = (milestoneId) => {
    setPaymentData({ ...paymentData, milestone_id: milestoneId });
    
    if (milestoneId && estimation) {
      const milestone = milestones.find(m => m.id === parseInt(milestoneId));
      if (milestone && milestone.default_percentage) {
        const suggestedAmount = (parseFloat(estimation.final_value || estimation.total_value || 0) * milestone.default_percentage) / 100;
        setPaymentData(prev => ({ ...prev, milestone_id: milestoneId, amount: suggestedAmount.toFixed(2) }));
      }
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

  if (!session || !project) return null;

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

  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'onboarding': return 'bg-blue-100 text-blue-700';
      case '2D': return 'bg-purple-100 text-purple-700';
      case '3D': return 'bg-amber-100 text-amber-700';
      case 'execution': return 'bg-green-100 text-green-700';
      case 'handover': return 'bg-slate-100 text-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Toaster richColors position="top-right" />
      <main className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                <Badge className={getPhaseColor(project.phase)}>
                  {project.phase}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {project.customer_name}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {project.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(project.created_at)}
                </span>
                {project.sales_order_id && (
                  <span className="flex items-center gap-1 font-medium text-primary">
                    <FileText className="h-4 w-4" />
                    SO: {project.sales_order_id}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={showPhaseDialog} onOpenChange={setShowPhaseDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={() => setPhaseUpdate({ phase: project.phase, remarks: '' })}>
                    <Edit className="h-4 w-4" />
                    Update Phase
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Project Phase</DialogTitle>
                    <DialogDescription>
                      Move the project to the next phase
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePhaseUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>New Phase</Label>
                      <Select value={phaseUpdate.phase} onValueChange={(value) => setPhaseUpdate({ ...phaseUpdate, phase: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onboarding">Onboarding</SelectItem>
                          <SelectItem value="2D">2D Design</SelectItem>
                          <SelectItem value="3D">3D Design</SelectItem>
                          <SelectItem value="execution">Execution</SelectItem>
                          <SelectItem value="handover">Handover</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea
                        value={phaseUpdate.remarks}
                        onChange={(e) => setPhaseUpdate({ ...phaseUpdate, remarks: e.target.value })}
                        placeholder="Add any notes about this phase change..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowPhaseDialog(false)}>Cancel</Button>
                      <Button type="submit">Update Phase</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Link href={`/projects/${projectId}/estimation`}>
                <Button className="gap-2">
                  <FileText className="h-4 w-4" />
                  Manage Estimation
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(estimation?.total_value || 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Received from Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(project.payments_received)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Paid to Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(project.payments_made)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(project.payments_received - project.payments_made)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="estimation" className="space-y-4">
          <TabsList>
            <TabsTrigger value="estimation">Estimation</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="boqs">Vendor BOQs</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="estimation" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Project Estimation</CardTitle>
                    <CardDescription>
                      {estimation ? `Version ${estimation.version} • ${estimation.status}` : 'No estimation created yet'}
                    </CardDescription>
                  </div>
                  <Link href={`/projects/${projectId}/estimation`}>
                    <Button size="sm" className="gap-2">
                      {estimation ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {estimation ? 'Edit Estimation' : 'Create Estimation'}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {estimation ? (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Woodwork</p>
                        <p className="text-xl font-bold">{formatCurrency(estimation.woodwork_value)}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Misc Internal</p>
                        <p className="text-xl font-bold">{formatCurrency(estimation.misc_internal_value)}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Misc External</p>
                        <p className="text-xl font-bold">{formatCurrency(estimation.misc_external_value)}</p>
                      </div>
                    </div>

                    {estimationItems.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-3">Category</th>
                              <th className="text-left p-3">Description</th>
                              <th className="text-right p-3">Quantity</th>
                              <th className="text-right p-3">Unit Price</th>
                              <th className="text-right p-3">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {estimationItems.slice(0, 5).map((item) => (
                              <tr key={item.id}>
                                <td className="p-3">
                                  <Badge variant="outline" className="capitalize">
                                    {item.category?.replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="p-3">{item.description}</td>
                                <td className="text-right p-3">{item.quantity} {item.unit}</td>
                                <td className="text-right p-3">{formatCurrency(item.unit_price)}</td>
                                <td className="text-right p-3 font-medium">{formatCurrency(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {estimationItems.length > 5 && (
                          <div className="p-3 bg-slate-50 text-center text-sm text-muted-foreground">
                            +{estimationItems.length - 5} more items
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No estimation created yet</p>
                    <Link href={`/projects/${projectId}/estimation`}>
                      <Button>Create Estimation</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Customer Payments</CardTitle>
                    <CardDescription>Money received from customer</CardDescription>
                  </div>
                  <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Record Payment
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Record Customer Payment</DialogTitle>
                        <DialogDescription>
                          Add a new payment received from customer
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleRecordPayment} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Payment Type</Label>
                          <Select value={paymentData.payment_type} onValueChange={(value) => setPaymentData({ ...paymentData, payment_type: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="advance_10">Advance 10%</SelectItem>
                              <SelectItem value="3D_50">3D Design 50%</SelectItem>
                              <SelectItem value="misc_100">Misc Items 100%</SelectItem>
                              <SelectItem value="final">Final Payment</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Payment Mode</Label>
                          <Select value={paymentData.mode} onValueChange={(value) => setPaymentData({ ...paymentData, mode: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Reference Number</Label>
                          <Input
                            placeholder="Transaction ID / Cheque Number"
                            value={paymentData.reference_number}
                            onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Remarks</Label>
                          <Textarea
                            value={paymentData.remarks}
                            onChange={(e) => setPaymentData({ ...paymentData, remarks: e.target.value })}
                            placeholder="Add any notes..."
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
                          <Button type="submit">Record Payment</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {customerPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <IndianRupee className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{payment.payment_type?.replace('_', ' ').toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payment.payment_date)} • {payment.mode} • {payment.reference_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
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
          </TabsContent>

          <TabsContent value="boqs" className="space-y-4">
            <Card>
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
                            <Badge className={`text-xs ${
                              boq.status === 'draft' ? 'bg-slate-100 text-slate-700' :
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
          </TabsContent>

          <TabsContent value="ledger" className="space-y-4">
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
                        <div>
                          <p className="font-medium">{entry.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(entry.transaction_date)} • {entry.transaction_type}
                            {entry.reference_number && ` • ${entry.reference_number}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${
                            entry.amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
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
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Project Code</p>
                    <p className="font-medium">{project.project_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Customer</p>
                    <p className="font-medium">{project.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{project.customer_phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <p className="font-medium">{project.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phase</p>
                    <Badge className={getPhaseColor(project.phase)}>
                      {project.phase}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Created By</p>
                    <p className="font-medium">{project.created_by_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Created On</p>
                    <p className="font-medium">{formatDate(project.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
