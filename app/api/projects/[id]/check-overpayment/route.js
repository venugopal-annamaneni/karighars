import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PAYMENT_STATUS } from '@/app/constants';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const project_id = params.id;
  const { final_value } = body;

  // Get total approved payments
  const paymentsRes = await query(`
        SELECT COALESCE(SUM(amount), 0) as total_collected
        FROM customer_payments
        WHERE project_id = $1 AND status = $2
      `, [project_id, PAYMENT_STATUS.APPROVED]);

  const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);
  const grandTotal = parseFloat(final_value);

  if (totalCollected > grandTotal) {
    const overpaymentAmount = totalCollected - grandTotal;
    return NextResponse.json({
      has_overpayment: true,
      overpayment_amount: overpaymentAmount,
      total_collected: totalCollected,
      new_estimation_total: grandTotal
    });
  }

  return NextResponse.json({ has_overpayment: false });
}