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
  const [documents, setDocuments] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showEstimationDialog, setShowEstimationDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [invoiceData, setInvoiceData] = useState({
    invoice_url: null,
    revenue_realized: ''
  });
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState({});
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  
  const [stageUpdate, setStageUpdate] = useState({ phase: '', remarks: '' });
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
      const [projectRes, paymentsRes, vendorPaymentsRes, boqsRes, ledgerRes, docsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/customer-payments?project_id=${projectId}`),
        fetch(`/api/vendor-payments?project_id=${projectId}`),
        fetch(`/api/vendor-boqs?project_id=${projectId}`),
        fetch(`/api/projects/${projectId}/ledger`),
        fetch(`/api/documents/project/${projectId}`)
      ]);

      let projectData = null;

      if (projectRes.ok) {
        const data = await projectRes.json();
        projectData = data.project;
        // Merge the project data with payment totals
        setProject({
          ...data.project,
          payments_received: data.payments_received,
          payments_made: data.payments_made
        });
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

      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents);
      }

      // Fetch milestones and stages if project has biz_model_id
      if (projectData && projectData.biz_model_id) {
        const bizModelRes = await fetch(`/api/biz-models/${projectData.biz_model_id}`);
        if (bizModelRes.ok) {
          const bizData = await bizModelRes.json();
          setMilestones(bizData.milestones.filter(m => m.direction === 'inflow'));
          setStages(bizData.stages || []);
        }
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageUpdate)
      });

      if (res.ok) {
        toast.success('Project stage updated');
        setShowStageDialog(false);
        fetchProjectData();
      } else {
        toast.error('Failed to update stage');
      }
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('An error occurred');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      // Get GST percentage from estimation (default 18% if not available)
      const gstPercentage = parseFloat(estimation?.gst_percentage || 18);
      
      // Back-calculate pre-tax amount and GST amount from total
      const totalAmount = parseFloat(paymentData.amount || 0);
      const preTaxAmount = totalAmount / (1 + gstPercentage / 100);
      const gstAmount = totalAmount - preTaxAmount;
      
      // Use direct woodwork and misc amounts entered by user
      // These should also be GST-inclusive amounts
      const woodworkAmount = parseFloat(paymentData.woodwork_amount || 0);
      const miscAmount = parseFloat(paymentData.misc_amount || 0);
      
      // Back-calculate pre-tax woodwork and misc
      const preTaxWoodwork = woodworkAmount / (1 + gstPercentage / 100);
      const preTaxMisc = miscAmount / (1 + gstPercentage / 100);

      // Get payment type from milestone or use default
      let paymentType = 'other';
      let finalMilestoneId = null;
      
      if (paymentData.milestone_id === 'MISC') {
        // Ad-hoc payment - no milestone_id
        paymentType = 'MISC';
        finalMilestoneId = null;
      } else if (paymentData.milestone_id) {
        const milestone = milestones.find(m => m.id === parseInt(paymentData.milestone_id));
        if (milestone) {
          paymentType = milestone.milestone_code;
          finalMilestoneId = paymentData.milestone_id;
        }
      }

      const res = await fetch('/api/customer-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          customer_id: project.customer_id,
          estimation_id: estimation?.id,
          milestone_id: finalMilestoneId,
          payment_type: paymentType,
          amount: totalAmount.toFixed(2),
          pre_tax_amount: preTaxAmount.toFixed(2),
          gst_amount: gstAmount.toFixed(2),
          gst_percentage: gstPercentage,
          mode: paymentData.mode,
          reference_number: paymentData.reference_number,
          remarks: paymentData.remarks,
          override_reason: paymentData.override_reason,
          status: 'pending', // Payment starts as pending until receipt is uploaded
          woodwork_amount: preTaxWoodwork.toFixed(2),
          misc_amount: preTaxMisc.toFixed(2)
        })
      });

      if (res.ok) {
        toast.success('Payment recorded successfully. Pending receipt upload by Finance team.');
        setShowPaymentDialog(false);
        setPaymentData({
          milestone_id: '',
          payment_type: 'advance_10',
          amount: '',
          woodwork_amount: '',
          misc_amount: '',
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

  const handleMilestoneChange = async (milestoneId) => {
    if (!milestoneId || milestoneId === 'none' || !estimation) {
      setPaymentData(prev => ({ 
        ...prev, 
        milestone_id: '', 
        amount: '', 
        woodwork_amount: '',
        misc_amount: '',
        calculation: null, 
        expected_amount: null 
      }));
      return;
    }

    // Handle MISC (Ad-hoc) payment - no calculation needed
    if (milestoneId === 'MISC') {
      setPaymentData(prev => ({ 
        ...prev, 
        milestone_id: 'MISC', 
        amount: '',
        woodwork_amount: '',
        misc_amount: '',
        expected_amount: null,
        calculation: {
          is_misc_payment: true,
          woodwork_value: (parseFloat(estimation.woodwork_value || 0) + parseFloat(estimation.woodwork_value || 0) * parseFloat(estimation.gst_percentage || 18) / 100),
          misc_value: ((parseFloat(estimation.misc_internal_value || 0) + parseFloat(estimation.misc_external_value || 0)) * (1 + parseFloat(estimation.gst_percentage || 18) / 100))
        }
      }));
      return;
    }

    // Fetch cumulative calculation from API for milestone-based payments
    try {
      const res = await fetch(`/api/calculate-payment/${projectId}/${milestoneId}`);
      if (!res.ok) {
        toast.error('Failed to calculate expected amount');
        return;
      }

      const data = await res.json();

      if (data.is_misc_payment) {
        // MISC_PAYMENT: No auto-calculation
        setPaymentData(prev => ({ 
          ...prev, 
          milestone_id: milestoneId, 
          amount: '',
          woodwork_amount: '',
          misc_amount: '',
          expected_amount: null,
          calculation: null
        }));
      } else {
        // Pre-fill with expected amounts
        const woodworkAmt = data.expected_woodwork_amount.toFixed(2);
        const miscAmt = data.expected_misc_amount.toFixed(2);
        const totalAmt = data.expected_total.toFixed(2);
        
        setPaymentData(prev => ({ 
          ...prev, 
          milestone_id: milestoneId, 
          woodwork_amount: woodworkAmt,
          misc_amount: miscAmt,
          amount: totalAmt,
          expected_amount: totalAmt,
          calculation: data
        }));
      }
    } catch (error) {
      console.error('Error calculating payment:', error);
      toast.error('Error calculating expected amount');
    }
  };

  const handleInvoiceUpload = async (file) => {
    if (!file) return;
    
    // Check if user is Finance role
    if (session.user.role !== 'finance' && session.user.role !== 'admin') {
      toast.error('Only Finance team can upload invoices');
      return;
    }
    
    setUploadingInvoice(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setInvoiceData(prev => ({ ...prev, invoice_url: data.url }));
        toast.success('Invoice uploaded successfully');
      } else {
        toast.error('Failed to upload invoice');
      }
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.error('Upload failed');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_url: invoiceData.invoice_url,
          revenue_realized: invoiceData.revenue_realized
        })
      });

      if (res.ok) {
        // Create document record
        if (invoiceData.invoice_url) {
          await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              related_entity: 'project',
              related_id: projectId,
              document_type: 'project_invoice',
              document_url: invoiceData.invoice_url,
              file_name: 'Project Invoice',
              remarks: `Invoice for revenue realized: ₹${invoiceData.revenue_realized}`
            })
          });
        }

        toast.success('Invoice uploaded successfully');
        setShowInvoiceDialog(false);
        setInvoiceData({ invoice_url: null, revenue_realized: '' });
        fetchProjectData();
      } else {
        toast.error('Failed to save invoice');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('An error occurred');
    }
  };

  const handlePaymentReceiptUpload = async (paymentId, file) => {
    if (!file) return;

    setUploadingReceipt(prev => ({ ...prev, [paymentId]: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Upload file
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        toast.error('Failed to upload receipt');
        return;
      }

      const uploadData = await uploadRes.json();

      // Update payment status and receipt URL
      const updateRes = await fetch(`/api/customer-payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_url: uploadData.url,
          status: 'approved'
        })
      });

      if (!updateRes.ok) {
        toast.error('Failed to approve payment');
        return;
      }

      // Create document record
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          related_entity: 'payment',
          related_id: paymentId,
          document_type: 'payment_receipt',
          document_url: uploadData.url,
          file_name: uploadData.fileName,
          file_size: uploadData.size,
          mime_type: uploadData.type,
          remarks: 'Payment receipt'
        })
      });

      toast.success('Receipt uploaded and payment approved!');
      fetchProjectData();
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast.error('An error occurred');
    } finally {
      setUploadingReceipt(prev => ({ ...prev, [paymentId]: false }));
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
              <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={() => setStageUpdate({ phase: project.phase, remarks: '' })}>
                    <Edit className="h-4 w-4" />
                    Update Stage
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Project Stage</DialogTitle>
                    <DialogDescription>
                      Move the project to the next stage
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleStageUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>New Stage</Label>
                      <Select value={stageUpdate.phase} onValueChange={(value) => setStageUpdate({ ...stageUpdate, phase: value })}>
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
                        value={stageUpdate.remarks}
                        onChange={(e) => setStageUpdate({ ...stageUpdate, remarks: e.target.value })}
                        placeholder="Add any notes about this stage change..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowStageDialog(false)}>Cancel</Button>
                      <Button type="submit">Update Stage</Button>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Value (with GST)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency((parseFloat(estimation?.final_value || 0) + parseFloat(estimation?.gst_amount || 0)))}
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
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Overpayment Alert */}
          {estimation && estimation.has_overpayment && estimation.overpayment_status === 'pending_approval' && (
            <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-900 mb-2">⚠️ OVERPAYMENT DETECTED - Action Required</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-3 rounded border border-red-200">
                      <p className="text-sm text-red-700 mb-1">Total Collected (Approved)</p>
                      <p className="text-xl font-bold text-red-900">
                        ₹{((parseFloat(estimation.final_value) + parseFloat(estimation.gst_amount) + parseFloat(estimation.overpayment_amount || 0))).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded border border-red-200">
                      <p className="text-sm text-red-700 mb-1">Revised Estimation</p>
                      <p className="text-xl font-bold text-red-900">
                        ₹{(parseFloat(estimation.final_value) + parseFloat(estimation.gst_amount)).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
                    <p className="text-sm font-semibold text-red-900">Overpayment Amount:</p>
                    <p className="text-2xl font-bold text-red-600">₹{parseFloat(estimation.overpayment_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="space-y-2 text-sm text-red-800 mb-4">
                    <p className="font-semibold">Required Actions:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Admin must approve this overpayment</li>
                      <li>System will create credit reversal entry</li>
                      <li>Finance team uploads credit note document</li>
                      <li>Ledger will reflect the adjustment</li>
                    </ol>
                  </div>
                  {session.user.role === 'admin' && (
                    <Button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/estimations/${estimation.id}/approve-overpayment`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                          });
                          if (res.ok) {
                            toast.success('Overpayment approved! Credit reversal entry created.');
                            fetchProjectData();
                          } else {
                            const data = await res.json();
                            toast.error(data.error || 'Failed to approve overpayment');
                          }
                        } catch (error) {
                          console.error('Error:', error);
                          toast.error('An error occurred');
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Approve Overpayment & Create Credit Reversal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

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
                    <div className="grid md:grid-cols-4 gap-4">
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
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Subtotal</p>
                        <p className="text-xl font-bold">{formatCurrency(estimation.total_value)}</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700 mb-1">Service Charge ({estimation.service_charge_percentage || 0}%)</p>
                        <p className="text-xl font-bold text-green-700">+{formatCurrency(estimation.service_charge_amount || 0)}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <p className="text-sm text-red-700 mb-1">Discount ({estimation.discount_percentage || 0}%)</p>
                        <p className="text-xl font-bold text-red-700">-{formatCurrency(estimation.discount_amount || 0)}</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700 mb-1">GST ({estimation.gst_percentage || 18}%)</p>
                        <p className="text-xl font-bold text-blue-700">+{formatCurrency(estimation.gst_amount || 0)}</p>
                      </div>
                      <div className="bg-primary/10 p-4 rounded-lg border border-primary">
                        <p className="text-sm text-primary mb-1">Final Total (with GST)</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency((parseFloat(estimation.final_value || 0) + parseFloat(estimation.gst_amount || 0)))}</p>
                      </div>
                    </div>

                    {estimation.requires_approval && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                        <p className="text-sm font-medium text-amber-800">⚠️ This estimation requires approval</p>
                        <p className="text-xs text-amber-700 mt-1">Discount exceeds maximum allowed percentage</p>
                      </div>
                    )}

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
                    <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Record Customer Payment</DialogTitle>
                        <DialogDescription>
                          Add a new payment received from customer
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleRecordPayment} className="space-y-4">
                        {milestones.length > 0 ? (
                          <div className="space-y-2">
                            <Label>Payment Type</Label>
                            <Select value={paymentData.milestone_id} onValueChange={handleMilestoneChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No milestone</SelectItem>
                                <SelectItem value="MISC">🎯 Ad-hoc Payment (MISC)</SelectItem>
                                {milestones.map((milestone) => (
                                  <SelectItem key={milestone.id} value={milestone.id.toString()}>
                                    {milestone.milestone_name} - {milestone.milestone_code === 'MISC_PAYMENT' ? 'User Entered' : `W:${milestone.woodwork_percentage}% M:${milestone.misc_percentage}%`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {paymentData.milestone_id === 'MISC' && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                                <p className="font-semibold mb-1">💡 Ad-hoc Payment Mode</p>
                                <p>• Collect any amount up to 100% of Woodwork and 100% of Misc</p>
                                <p>• Not tied to project stages or milestones</p>
                                <p>• System will track cumulative collection automatically</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                            ⚠️ No milestones configured for this project's BizModel. You can still collect ad-hoc payments by selecting "Ad-hoc Payment (MISC)".
                          </div>
                        )}
                        {/* Show Expected Amount Calculation with Cumulative Info */}
                        {paymentData.calculation && paymentData.calculation.is_misc_payment && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                            <div>
                              <p className="text-sm font-medium text-green-900">🎯 Ad-hoc Payment - Available to Collect</p>
                              <p className="text-xs text-green-700 mb-2">You can collect any amount up to 100% of each category</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white p-2 rounded">
                                <p className="text-xs text-green-700">Woodwork Total (GST-incl)</p>
                                <p className="text-lg font-bold text-green-800">₹{parseFloat(paymentData.calculation.woodwork_value || 0).toLocaleString('en-IN')}</p>
                              </div>
                              <div className="bg-white p-2 rounded">
                                <p className="text-xs text-green-700">Misc Total (GST-incl)</p>
                                <p className="text-lg font-bold text-green-800">₹{parseFloat(paymentData.calculation.misc_value || 0).toLocaleString('en-IN')}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {paymentData.calculation && !paymentData.calculation.is_misc_payment && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                            <div>
                              <p className="text-sm font-medium text-blue-900">💰 Expected Receivable (Cumulative)</p>
                              <p className="text-2xl font-bold text-blue-700">₹{parseFloat(paymentData.calculation.expected_total).toLocaleString('en-IN')}</p>
                            </div>

                            {/* Woodwork Breakdown */}
                            {paymentData.calculation.expected_woodwork_amount > 0 && (
                              <div className="border-t border-blue-200 pt-2">
                                <p className="text-xs font-semibold text-blue-800 mb-1">🪵 Woodwork Component:</p>
                                <div className="text-xs text-blue-700 space-y-1 ml-3">
                                  <div>Total Value: ₹{parseFloat(paymentData.calculation.woodwork_value).toLocaleString('en-IN')}</div>
                                  <div>Target: {paymentData.calculation.target_woodwork_percentage.toFixed(1)}% → ₹{((paymentData.calculation.woodwork_value * paymentData.calculation.target_woodwork_percentage) / 100).toLocaleString('en-IN')}</div>
                                  <div>Already Collected: {paymentData.calculation.collected_woodwork_percentage.toFixed(1)}% → ₹{parseFloat(paymentData.calculation.collected_woodwork_amount).toLocaleString('en-IN')}</div>
                                  <div className="font-semibold text-green-700">To Collect Now: {paymentData.calculation.remaining_woodwork_percentage.toFixed(1)}% → ₹{parseFloat(paymentData.calculation.expected_woodwork_amount).toLocaleString('en-IN')}</div>
                                </div>
                              </div>
                            )}

                            {/* Misc Breakdown */}
                            {paymentData.calculation.expected_misc_amount > 0 && (
                              <div className="border-t border-blue-200 pt-2">
                                <p className="text-xs font-semibold text-blue-800 mb-1">🔧 Misc Component:</p>
                                <div className="text-xs text-blue-700 space-y-1 ml-3">
                                  <div>Total Value: ₹{parseFloat(paymentData.calculation.misc_value).toLocaleString('en-IN')}</div>
                                  <div>Target: {paymentData.calculation.target_misc_percentage.toFixed(1)}% → ₹{((paymentData.calculation.misc_value * paymentData.calculation.target_misc_percentage) / 100).toLocaleString('en-IN')}</div>
                                  <div>Already Collected: {paymentData.calculation.collected_misc_percentage.toFixed(1)}% → ₹{parseFloat(paymentData.calculation.collected_misc_amount).toLocaleString('en-IN')}</div>
                                  <div className="font-semibold text-green-700">To Collect Now: {paymentData.calculation.remaining_misc_percentage.toFixed(1)}% → ₹{parseFloat(paymentData.calculation.expected_misc_amount).toLocaleString('en-IN')}</div>
                                </div>
                              </div>
                            )}

                            {paymentData.calculation.expected_total === 0 && (
                              <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                                ⚠️ Target milestone percentage already collected. No additional payment expected.
                              </div>
                            )}
                          </div>
                        )}

                        {paymentData.milestone_id && !paymentData.calculation && (
                          <div className="text-sm text-muted-foreground">Loading calculation...</div>
                        )}

                        {/* Category-wise Amount to Collect - Prominent Display */}
                        {paymentData.calculation && !paymentData.calculation.is_misc_payment && paymentData.calculation.expected_total > 0 && (
                          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                            <p className="text-sm font-semibold text-green-900 mb-2">📊 Amount to Collect (Category-wise):</p>
                            <div className="grid grid-cols-2 gap-3">
                              {paymentData.calculation.expected_woodwork_amount > 0 && (
                                <div className="bg-white rounded p-2 border border-green-200">
                                  <p className="text-xs text-gray-600">🪵 Woodwork</p>
                                  <p className="text-lg font-bold text-green-700">₹{parseFloat(paymentData.calculation.expected_woodwork_amount).toLocaleString('en-IN')}</p>
                                  <p className="text-xs text-gray-500">{paymentData.calculation.remaining_woodwork_percentage.toFixed(1)}%</p>
                                </div>
                              )}
                              {paymentData.calculation.expected_misc_amount > 0 && (
                                <div className="bg-white rounded p-2 border border-green-200">
                                  <p className="text-xs text-gray-600">🔧 Misc</p>
                                  <p className="text-lg font-bold text-green-700">₹{parseFloat(paymentData.calculation.expected_misc_amount).toLocaleString('en-IN')}</p>
                                  <p className="text-xs text-gray-500">{paymentData.calculation.remaining_misc_percentage.toFixed(1)}%</p>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-green-200">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-green-900">Total Expected:</span>
                                <span className="text-xl font-bold text-green-700">₹{parseFloat(paymentData.calculation.expected_total).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Input fields for actual amounts */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-sm font-semibold">Enter Actual Amount Collected:</p>
                          
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Amount towards Woodwork (₹) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={paymentData.woodwork_amount || ''}
                                onChange={(e) => {
                                  const woodwork = e.target.value;
                                  const misc = paymentData.misc_amount || 0;
                                  const total = (parseFloat(woodwork) || 0) + (parseFloat(misc) || 0);
                                  setPaymentData({ 
                                    ...paymentData, 
                                    woodwork_amount: woodwork,
                                    amount: total.toFixed(2)
                                  });
                                }}
                                required
                              />
                              {paymentData.calculation && paymentData.calculation.expected_woodwork_amount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Expected: ₹{parseFloat(paymentData.calculation.expected_woodwork_amount).toLocaleString('en-IN')}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>Amount towards Misc (₹) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={paymentData.misc_amount || ''}
                                onChange={(e) => {
                                  const misc = e.target.value;
                                  const woodwork = paymentData.woodwork_amount || 0;
                                  const total = (parseFloat(woodwork) || 0) + (parseFloat(misc) || 0);
                                  setPaymentData({ 
                                    ...paymentData, 
                                    misc_amount: misc,
                                    amount: total.toFixed(2)
                                  });
                                }}
                                required
                              />
                              {paymentData.calculation && paymentData.calculation.expected_misc_amount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Expected: ₹{parseFloat(paymentData.calculation.expected_misc_amount).toLocaleString('en-IN')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Auto-calculated Total */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-blue-900">Total Amount Collected:</span>
                              <span className="text-2xl font-bold text-blue-700">
                                ₹{paymentData.amount ? parseFloat(paymentData.amount).toLocaleString('en-IN') : '0'}
                              </span>
                            </div>
                            {paymentData.expected_amount && paymentData.amount && (
                              <p className={`text-xs mt-1 ${Math.abs(parseFloat(paymentData.amount) - parseFloat(paymentData.expected_amount)) > 1 ? 'text-amber-600' : 'text-green-600'}`}>
                                {Math.abs(parseFloat(paymentData.amount) - parseFloat(paymentData.expected_amount)) > 1 
                                  ? `⚠️ Difference from expected: ₹${Math.abs(parseFloat(paymentData.amount) - parseFloat(paymentData.expected_amount)).toFixed(2)}`
                                  : '✓ Matches expected amount'}
                              </p>
                            )}
                            
                            {/* GST Breakdown */}
                            {estimation && paymentData.amount && parseFloat(paymentData.amount) > 0 && (
                              <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                                <p className="text-xs font-semibold text-blue-900 mb-2">GST Breakdown (at {estimation.gst_percentage || 18}%):</p>
                                <div className="flex justify-between text-xs">
                                  <span className="text-blue-700">Pre-Tax Amount:</span>
                                  <span className="font-medium">₹{(parseFloat(paymentData.amount) / (1 + (estimation.gst_percentage || 18) / 100)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-blue-700">GST Amount:</span>
                                  <span className="font-medium">₹{(parseFloat(paymentData.amount) - (parseFloat(paymentData.amount) / (1 + (estimation.gst_percentage || 18) / 100))).toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-blue-600 italic mt-1">* All amounts entered above should include GST</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Mode</Label>
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

                        <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-4">
                          <p className="text-sm text-amber-800">
                            ℹ️ This payment will be marked as <strong>pending</strong> until Finance team uploads the receipt.
                          </p>
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
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{payment.payment_type?.replace('_', ' ').toUpperCase()}</p>
                            {payment.status === 'pending' && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                Pending Receipt
                              </Badge>
                            )}
                            {payment.status === 'approved' && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                ✓ Approved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payment.payment_date)} • {payment.mode} • {payment.reference_number}
                          </p>
                          {payment.gst_amount > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              GST: ₹{payment.gst_amount?.toLocaleString('en-IN')} ({payment.gst_percentage}%)
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-xl font-bold ${payment.status === 'approved' ? 'text-green-600' : 'text-gray-400'}`}>
                              {formatCurrency(payment.amount)}
                            </p>
                            {payment.status === 'pending' && (
                              <p className="text-xs text-amber-600">Not counted</p>
                            )}
                          </div>
                          {payment.status === 'pending' && (session?.user?.role === 'finance' || session?.user?.role === 'admin') && (
                            <div>
                              <input
                                type="file"
                                id={`receipt-${payment.id}`}
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) handlePaymentReceiptUpload(payment.id, file);
                                }}
                                disabled={uploadingReceipt[payment.id]}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById(`receipt-${payment.id}`).click()}
                                disabled={uploadingReceipt[payment.id]}
                              >
                                {uploadingReceipt[payment.id] ? 'Uploading...' : 'Upload Receipt'}
                              </Button>
                            </div>
                          )}
                          {payment.receipt_url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
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
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium capitalize">{entry.transaction_type}</p>
                            {entry.entry_type === 'credit' && (
                              <Badge className="bg-green-100 text-green-700">Inflow</Badge>
                            )}
                            {entry.entry_type === 'debit' && (
                              <Badge className="bg-red-100 text-red-700">Outflow</Badge>
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
                          </p>
                          {entry.remarks && (
                            <p className="text-sm text-muted-foreground mt-1">{entry.remarks}</p>
                          )}
                        </div>
                        <div className="text-right ml-6">
                          <p className={`text-xl font-bold ${
                            entry.entry_type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {entry.entry_type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
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

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Project Documents</CardTitle>
                    <CardDescription>View all documents related to this project</CardDescription>
                  </div>
                  {(session?.user?.role === 'finance' || session?.user?.role === 'admin') && (
                    <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          Upload Invoice
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Upload Project Invoice</DialogTitle>
                          <DialogDescription>
                            Upload invoice and record revenue realized
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="invoice_file">Invoice Document *</Label>
                            <Input
                              id="invoice_file"
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleInvoiceUpload(e.target.files[0])}
                              disabled={uploadingInvoice}
                              required={!invoiceData.invoice_url}
                            />
                            {invoiceData.invoice_url && <p className="text-xs text-green-600">✓ Invoice uploaded</p>}
                            {uploadingInvoice && <p className="text-xs text-blue-600">Uploading...</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="revenue_realized">Revenue Realized (₹)</Label>
                            <Input
                              id="revenue_realized"
                              type="number"
                              step="0.01"
                              placeholder="Enter revenue amount"
                              value={invoiceData.revenue_realized}
                              onChange={(e) => setInvoiceData({ ...invoiceData, revenue_realized: e.target.value })}
                              required
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
                            <Button type="submit" disabled={uploadingInvoice || !invoiceData.invoice_url}>Upload Invoice</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {project.invoice_url && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-900">Project Invoice</p>
                        <p className="text-sm text-green-700">Revenue Realized: ₹{project.revenue_realized?.toLocaleString('en-IN') || '0'}</p>
                        <p className="text-xs text-green-600 mt-1">Uploaded on {project.invoice_uploaded_at ? formatDate(project.invoice_uploaded_at) : 'N/A'}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={project.invoice_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {documents.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                        <div>
                          <p className="font-medium">{doc.file_name || 'Document'}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.document_type === 'kyc_aadhar' && 'KYC - Aadhar Card'}
                            {doc.document_type === 'kyc_pan' && 'KYC - PAN Card'}
                            {doc.document_type === 'kyc_cheque' && 'KYC - Blank Cheque'}
                            {doc.document_type === 'payment_receipt' && 'Payment Receipt'}
                            {doc.document_type === 'project_invoice' && 'Project Invoice'}
                            {doc.document_type === 'other' && 'Other Document'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploaded by {doc.uploaded_by_name || 'N/A'} on {formatDate(doc.uploaded_at)}
                          </p>
                          {doc.remarks && (
                            <p className="text-xs text-muted-foreground mt-1">Note: {doc.remarks}</p>
                          )}
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-2" />
                            View
                          </a>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
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
                    <p className="text-sm text-muted-foreground mb-1">Sales Order ID</p>
                    <p className="font-medium">{project.sales_order_id || 'Not Generated'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Business Model</p>
                    <p className="font-medium">{project.biz_model_name || 'No BizModel'}</p>
                  </div>
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
