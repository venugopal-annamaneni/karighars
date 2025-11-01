export const PROJECT_STAGES = {
  ONBOARDING: 'ONBOARDING',
  '2D': '2D',
  '3D': '3D',
  EXEC: 'EXEC',
  HANDOVER: 'HANDOVER',
  ANY: 'ANY'
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const INVOICE_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending'
};

export const LEDGER_ENTRY_TYPE = {
  CREDIT: 'Credit',
  DEBIT: 'Debit'
}

export const DOCUMENT_TYPE = {
  PAYMENT_RECEIPT: 'Payment Receipt',
  PROJECT_INVOICE: 'Project Invoice',
  RECEIPT_REVERSAL: 'Receipt Reversal',
  KYC_AADHAR: 'kyc_aadhar',
  KYC_PAN: 'kyc_pan',
  KYC_CHEQUE: 'kyc_cheque'
}

export const USER_ROLE = {
  ADMIN: 'admin',
  FINANCE: 'finance',
  SALES: 'sales',
  ESTIMATOR: 'estimator',
  DESIGNER: 'designer',
  PROJECT_MANAGER: 'project manager',
  ALL: 'all'  
};

export const BIZMODEL_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
}

export const ESTIMATION_STATUS = {
  DRAFT: 'draft',
  FINALIZED: 'finalized',
  APPROVED: 'approved'
}

export const ESTIMATION_ITEM_STATUS = {
  QUEUED: 'Queued',
  PR_RAISED: 'PR Raised'
}

export const PURCHASE_REQUEST_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
}

export const ALERT_TYPE = {
  OVERPAYMENT_ALERT: "overpayment_alert",
  OVER_INVOICED_ALERT: "over_invoiced_alert"
}

// All other payment types in customer_payments.payment_type come from biz_model.milestones.milestone_code
export const REVERSAL_PAYMENT_TYPE = "PAYMENT_RECEIPT_REVERSAL"
export const INVOICE_RECORD_TYPE = {
  INVOICE: "Invoice",
  CREDIT_NOTE: "Credit Node"
}