import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { LEDGER_ENTRY_TYPE } from '@/app/constants';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  if(!projectId) {
    return NextResponse.json({ error: 'ProjectID is mandatory parameter' }, { status: 404 });
  }
  const result = await query(`
        SELECT pl.*, 
               CASE 
                 WHEN pl.source_table = 'customer_payments' THEN 'Customer Payment'
                 WHEN pl.source_table = 'payments_out' THEN 'Vendor Payment'
                 ELSE pl.source_table
               END as transaction_type,
               CASE
                 WHEN pl.source_table = 'customer_payments' THEN (
                   SELECT json_build_object(
                     'customer_name', c.name, 
                     'payment_type', cp.payment_type, 
                     'reference', cp.reference_number,
                     'approved_by_name', u.name
                   )
                   FROM customer_payments cp
                   LEFT JOIN customers c ON cp.customer_id = c.id
                   LEFT JOIN users u ON cp.approved_by = u.id
                   WHERE cp.id = pl.source_id
                 )
                 WHEN pl.source_table = 'payments_out' THEN (
                   SELECT json_build_object(
                     'vendor_name', v.name, 
                     'payment_stage', po.payment_stage, 
                     'reference', po.reference_number,
                     'approved_by_name', u.name
                   )
                   FROM payments_out po
                   LEFT JOIN vendors v ON po.vendor_id = v.id
                   LEFT JOIN users u ON po.created_by = u.id
                   WHERE po.id = pl.source_id
                 )
               END as transaction_details
        FROM project_ledger pl
        WHERE pl.project_id = $1
        ORDER BY pl.entry_date DESC, pl.id DESC
      `, [projectId]);

  // Calculate running balance
  let runningBalance = 0;
  const ledgerWithBalance = result.rows.map(entry => {
    if (entry.entry_type === LEDGER_ENTRY_TYPE.CREDIT) {
      runningBalance += parseFloat(entry.amount);
    } else {
      runningBalance -= parseFloat(entry.amount);
    }
    return {
      ...entry,
      running_balance: runningBalance
    };
  }).reverse(); // Reverse to show chronological order with running balance

  return NextResponse.json({ ledger: ledgerWithBalance.reverse() }); // Reverse back for latest first
}