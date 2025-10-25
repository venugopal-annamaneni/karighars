import { PAYMENT_STATUS, USER_ROLE } from "@/lib/constants";
import { Button } from "../ui/button";
import { toast } from "sonner";

const OverpaymentAlert = ({ estimation, userRole, fetchProjectData }) => {
  return (

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
              <p className="text-sm text-red-700 mb-1">Current Estimation Value</p>
              <p className="text-xl font-bold text-red-900">
                ₹{(parseFloat(estimation.final_value) + parseFloat(estimation.gst_amount)).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
            <p className="text-sm font-semibold text-red-900">Overpaid Amount:</p>
            <p className="text-2xl font-bold text-red-600">₹{parseFloat(estimation.overpayment_amount || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="space-y-2 text-sm text-red-800 mb-4">
            <p className="font-semibold">Required Actions:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Admin must approve this overpayment</li>
              <li>System will create receipt reversal record in Customer Payments (In {PAYMENT_STATUS.PENDING} state)</li>
              <li>Finance team uploads receipt reversal document</li>
              <li>Receipt reversal becomes approved and reflects in ledger</li>
              <li>Or creator can cancel and revert to previous version</li>
            </ol>
          </div>
          <div className="flex gap-3">
            {userRole === USER_ROLE.ADMIN && (
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/projects/${estimation.project_id}/customer-payments`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        "payment_type": "CREDIT_NOTE",
                        "project_id": estimation.project_id
                      })
                    });
                    if (res.ok) {
                      toast.success(`Overpayment approved! Credit note created in Customer Payments (pending document upload).`);
                      setTimeout(() => {fetchProjectData()}, 2000);
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
                Create Credit Note
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default OverpaymentAlert;