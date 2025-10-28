"use client";
import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DOCUMENT_TYPE, PAYMENT_STATUS, REVERSAL_PAYMENT_TYPE, USER_ROLE } from '@/app/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  AlertTriangle,
  FileText,
  IndianRupee,
  Plus,
  ShoppingBasketIcon
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function CustomerPaymentsPage() {

  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;


  //const [project, setProject] = useState(null);
  // const [estimation, setEstimation] = useState(null);
  const [stages, setStages] = useState([]);
  const [milestones, setMilestones] = useState([]);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState({});

  const [paymentData, setPaymentData] = useState({
    milestone_id: '',
    payment_type: '',
    amount: '',
    mode: 'bank',
    reference_number: '',
    remarks: '',
  });
  const { fetchProjectData, project, estimation, loading } = useProjectData();

  // Helper function for category icons
  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      'woodwork': '🪵',
      'misc': '🔧',
      'shopping': '🛒',
      'civil': '🏗️',
      'default': '📦'
    };
    return iconMap[categoryId?.toLowerCase()] || iconMap['default'];
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchCustomerPaymentData();
    }
  }, [status, router, projectId]);

  const fetchCustomerPaymentData = async () => {
    try {
      const paymentsRes = await fetch(`/api/projects/${projectId}/customer-payments`);

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setCustomerPayments(data.payments);
      }
      // Fetch milestones and stages if project has biz_model_id
      if (project && project.biz_model_id) {
        const bizModelRes = await fetch(`/api/biz-models/${project.biz_model_id}`);
        if (bizModelRes.ok) {
          const bizData = await bizModelRes.json();
          setMilestones(bizData.milestones.filter(m => m.direction === 'inflow'));
          setStages(bizData.stages || []);
        }
      }
    } catch (error) {
      console.error('Error fetching project customer payments:', error);
      toast.error('Failed to load project customer payments');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      // Back-calculate pre-tax amount and GST amount from total
      const totalAmount = parseFloat(paymentData.amount || 0);

      // Get payment type from milestone or use default
      let paymentType = '';
      let milestoneId = null;

      if (paymentData.milestone_id) {
        const milestone = milestones.find(m => m.id === parseInt(paymentData.milestone_id));
        if (milestone) {
          paymentType = milestone.milestone_code;
          milestoneId = paymentData.milestone_id;
        }
      } else {
        toast.error("Payment is not linked to any milestone. Technical issue, contact Admin");
        return;
      }
      

      const res = await fetch(`/api/projects/${projectId}/customer-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          customer_id: project.customer_id,
          milestone_id: milestoneId,
          payment_type: paymentType,
          amount: totalAmount.toFixed(2),
          mode: paymentData.mode,
          reference_number: paymentData.reference_number,
          remarks: paymentData.remarks,
          status: PAYMENT_STATUS.PENDING
        })
      });

      if (res.ok) {
        toast.success('Payment recorded successfully. Pending document upload by Finance team.');
        setShowPaymentDialog(false);
        setPaymentData({
          milestone_id: '',
          payment_type: '',
          amount: '',
          woodwork_amount: '',
          misc_amount: '',
          mode: 'bank',
          reference_number: '',
          remarks: ''
        });
        fetchCustomerPaymentData();

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
        calculation: null,
        expected_amount: null
      }));
      return;
    }

    // Fetch cumulative calculation from API for milestone-based payments
    try {
      const res = await fetch(`/api/projects/${projectId}/calculate-payment?milestone_id=${milestoneId}`);
      if (!res.ok) {
        toast.error('Failed to calculate expected amount');
        return;
      }

      const data = await res.json();
      // data.categories is now dynamic: { "woodwork": {total, target_percentage, target_amount}, ... }
      
      setPaymentData(prev => ({
        ...prev,
        milestone_id: milestoneId,
        amount: data.expected_total.toFixed(2),
        expected_amount: data.expected_total,
        calculation: data
      }));

    } catch (error) {
      console.error('Error calculating payment:', error);
      toast.error('Error calculating expected amount');
    }
  };

  const handleDocumentUpload = async (e, payment, user_id) => {
    const file = e.target.files[0];
    if (!file) return;

    let type = '';
    if (file) {
      if (payment.payment_type === REVERSAL_PAYMENT_TYPE) {
        type = DOCUMENT_TYPE.RECEIPT_REVERSAL;
      } else {
        type = DOCUMENT_TYPE.PAYMENT_RECEIPT;
      }
    }
    setUploadingReceipt(prev => ({ ...prev, [payment.id]: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      // Build dynamic payload
      const updateBody = { document_url: uploadData.url, status: 'approved', document_type: type };

      const updateRes = await fetch(`/api/projects/${projectId}/customer-payments/${payment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      if (!updateRes.ok) throw new Error('Failed to update payment');

      await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_type: "project",
          group_id: projectId,
          related_entity: 'customer_payments',
          related_id: payment.id,
          document_type: type,
          document_url: uploadData.url,
          file_name: uploadData.fileName,
          file_size: uploadData.size,
          mime_type: uploadData.type,
          uploaded_by: user_id
        }),
      });

      toast.success(
        type === 'receipt'
          ? 'Receipt uploaded and payment approved!'
          : 'Receipt reversal uploaded and approved!'
      );
      //fetchCustomerPaymentData();
      fetchProjectData(); // <- This triggers the entire page rendering, so no need to fetchCustomerPaymentData
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Failed to upload ${type}`);
    } finally {
      setUploadingReceipt(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  if (status === 'loading' || loading || paymentsLoading) {
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
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-3xl">
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
                      {milestones
                        .filter(milestone => (milestone.stage_code === project.stage || milestone.stage_code === 'ANY'))
                        .map((milestone) => {
                          // Format dynamic category percentages
                          const catPercentages = milestone.category_percentages || {};
                          const percentageDisplay = Object.entries(catPercentages)
                            .filter(([catId, pct]) => pct > 0)
                            .map(([catId, pct]) => `${catId.toUpperCase().substring(0, 1)}: ${pct}%`)
                            .join(', ') || 'No percentages';
                          
                          return (
                            <SelectItem key={milestone.id} value={milestone.id.toString()}>
                              {milestone.milestone_name} - {percentageDisplay}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  ⚠️ No milestones configured for this project's BizModel.".
                </div>
              )}
              {paymentData.calculation && paymentData.calculation.categories && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  {Object.entries(paymentData.calculation.categories)
                    .filter(([catId, catData]) => catData.target_amount > 0)
                    .sort((a, b) => (a[1].sort_order || 0) - (b[1].sort_order || 0))
                    .map(([categoryId, categoryData]) => (
                      <div key={categoryId} className="border-b border-green-200 pb-2 last:border-0">
                        <p className="text-xs font-semibold text-green-800 mb-1">
                          {getCategoryIcon(categoryId)} {categoryData.category_name}:
                        </p>
                        <div className="text-xs text-green-700 space-y-1 ml-3">
                          <div>Total Value: ₹{parseFloat(categoryData.total).toLocaleString('en-IN')}</div>
                          <div>Target: {categoryData.target_percentage.toFixed(1)}% → ₹{parseFloat(categoryData.target_amount).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    ))}

                  <div className="pt-2 border-t-2 border-green-300">
                    <p className="text-sm font-bold text-green-900">
                      💰 Total Expected: ₹{parseFloat(paymentData.calculation.expected_total).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Already Collected: ₹{parseFloat(paymentData.calculation.collected_total).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              )}



                  {paymentData.calculation.remaining_amount === 0 && (
                    <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                      ⚠️ Target milestone percentage already collected. No additional payment expected.
                    </div>
                  )}


                  <div className='grid grid-cols-3 md:grid-col-3 gap-3 bg-white p-4 rounded-lg'>
                    <div>
                      <p className="text-sm font-medium text-green-900">💰 Target Receivable</p>
                      <p className="text-2xl font-bold text-green-700">₹{parseFloat(paymentData.calculation.target_total).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">💰 Total Paid</p>
                      <p className="text-2xl font-bold text-blue-700">₹{parseFloat(paymentData.calculation.collected_total).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-900">💰 Expected Receiable</p>
                      <p className="text-2xl font-bold text-red-700">₹{parseFloat(paymentData.calculation.expected_total).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              )}

              {paymentData.milestone_id && !paymentData.calculation && (
                <div className="text-sm text-muted-foreground">Loading calculation...</div>
              )}

              {/* Amount to Collect - Prominent Display */}
              {/* {paymentData.calculation && paymentData.calculation.expected_total > 0 && (
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
                        )} */}

              {/* Input fields for actual amounts */}
              <div className="border-t pt-4 space-y-3">
                {/* <p className="text-sm font-semibold">Enter Actual Amount Collected:</p> */}

                <div className="grid md:grid-cols-1 gap-3">
                  {/* <div className="space-y-2">
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
                            </div> */}

                  <div className="space-y-2">
                    <Label>Amount Collected (₹) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={paymentData.amount || ''}
                      onChange={(e) => {
                        // const misc = e.target.value;
                        // const woodwork = paymentData.woodwork_amount || 0;
                        const amount = e.target.value;
                        const total = (parseFloat(amount) || 0);
                        setPaymentData({
                          ...paymentData,
                          amount: total.toFixed(2)
                        });
                      }}
                      required
                    />
                    {/* {paymentData.calculation && paymentData.calculation.expected_misc_amount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Expected: ₹{parseFloat(paymentData.calculation.expected_misc_amount).toLocaleString('en-IN')}
                                </p>
                              )} */}
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
                <Label>Mode *</Label>
                <Select required value={paymentData.mode} onValueChange={(value) => setPaymentData({ ...paymentData, mode: value })}>
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
                <Label>Reference Number *</Label>
                <Input
                  required
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
                  ℹ️ This payment will be marked as <strong>{PAYMENT_STATUS.PENDING}</strong> until Finance team uploads the receipt.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
                <Button
                  disabled={!paymentData.milestone_id || parseFloat(paymentData.amount || 0) <= 0}
                  type="submit"
                >
                  Record Payment
                </Button>
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
          <WarningExtraPendingReceipts estimation={estimation} payments={customerPayments} />
          {customerPayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{payment.payment_type.toUpperCase()}</p>
                  {payment.status === PAYMENT_STATUS.PENDING && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                      Pending Approval
                    </Badge>
                  )}
                  {payment.status === PAYMENT_STATUS.APPROVED && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      ✓ Approved
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(payment.payment_date)} • {payment.mode} • {payment.reference_number}
                </p>
                {payment.status === PAYMENT_STATUS.APPROVED && payment.approved_by_name && (
                  <p className="text-xs text-green-600 mt-1">
                    Approved by {payment.approved_by_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-xl font-bold ${payment.amount < 0
                    ? 'text-red-600'
                    : payment.status === PAYMENT_STATUS.APPROVED
                      ? 'text-green-600'
                      : 'text-gray-400'
                    }`}>
                    {formatCurrency(payment.amount)}
                  </p>
                  {payment.status === PAYMENT_STATUS.PENDING && (
                    <p className="text-xs text-amber-600">Not counted</p>
                  )}
                  {payment.payment_type === 'RECEIPT_REVERSAL' && (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800 text-xs mt-1">Receipt Reversal</Badge>
                  )}
                </div>
                {payment.status === PAYMENT_STATUS.PENDING && (session?.user?.role === USER_ROLE.FINANCE || session?.user?.role === USER_ROLE.ADMIN) && (
                  <div className='flex flex-col items-end gap-2'>
                    <div>
                      <input
                        type="file"
                        id={`${payment.payment_type === 'RECEIPT_REVERSAL' ? 'receipt-reversal' : 'receipt'}-${payment.id}`}
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleDocumentUpload(e, payment, session.user.id)}
                        disabled={uploadingReceipt[payment.id]}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById(`${payment.payment_type === 'RECEIPT_REVERSAL' ? 'receipt-reversal' : 'receipt'}-${payment.id}`).click()}
                        disabled={uploadingReceipt[payment.id]}
                      >
                        {uploadingReceipt[payment.id] ? 'Uploading...' : payment.payment_type === 'RECEIPT_REVERSAL' ? 'Upload Receipt Reversal' : 'Upload Receipt'}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { }}
                    >
                      {payment.payment_type === 'RECEIPT_REVERSAL' ? 'Cancel Receipt Reversal' : 'Cancel Payment'}
                    </Button>
                  </div>
                )}
                {payment.document_url && (
                  <Button size="sm" variant="ghost" asChild className={payment.payment_type === 'RECEIPT_REVERSAL' ? "text-red-600" : ""}>
                    <a href={payment.document_url} target="_blank" rel="noopener noreferrer">
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
}


const WarningExtraPendingReceipts = ({ estimation, payments }) => {
  const pendingReceipts = payments.filter(p => p.status === PAYMENT_STATUS.PENDING);
  const approvedReceipts = payments.filter(p => p.status === PAYMENT_STATUS.APPROVED)
  if (pendingReceipts.length === 0) return null;

  const estimationValue = parseFloat(estimation.final_value || 0);
  const approvedTotal = approvedReceipts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const pendingTotal = pendingReceipts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const remainingPayable = estimationValue - approvedTotal;


  const overPendingAmount = pendingTotal - remainingPayable;
  const overPendingAmountFormatted = formatCurrency(estimationValue);

  if (pendingTotal <= remainingPayable) return null;


  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          <span className="text-amber-900 font-bold">Overpayment Alert</span>
        </div>
        <p className="text-sm text-amber-800">
          Found <strong>{pendingReceipts.length} pending payment receipt{pendingReceipts.length > 1 ? 's' : ''}</strong> totaling{' '}
          <strong>{formatCurrency(pendingTotal)}</strong>. The current estimated project value is{' '}
          <strong>{overPendingAmountFormatted}</strong>.
        </p>
        <p className="text-sm text-amber-800">
          Project has approved payments worth <strong>{formatCurrency(approvedTotal)}</strong>.
          Pending approvals exceed the remaining payable amount by{' '}
          <strong className="text-amber-900">{formatCurrency(overPendingAmount)}</strong>.
        </p>
        <p className="text-sm text-amber-800">
          You may choose to <strong>cancel some/all pending approval</strong> payments to avoid future issuance of receipt reversals.
        </p>
      </div>
    </div>
  );

}