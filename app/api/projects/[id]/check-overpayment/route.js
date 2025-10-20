import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const project_id = params.id;
  const { final_value, gst_amount } = body;
  // Get next version number
  const versionRes = await query(
    'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM project_estimations WHERE project_id = $1',
    [project_id]
  );
  const nextVersion = versionRes.rows[0].next_version;
  // Only check if this is a revision (version > 1)
  if (nextVersion <= 1) {
    return NextResponse.json({ has_overpayment: false });
  }

  // Get total approved payments
  const paymentsRes = await query(`
        SELECT COALESCE(SUM(amount), 0) as total_collected
        FROM customer_payments
        WHERE project_id = $1 AND status = 'approved'
      `, [project_id]);

  const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);
  const grandTotal = parseFloat(final_value) + parseFloat(gst_amount);

  if (totalCollected > grandTotal) {
    const overpaymentAmount = totalCollected - grandTotal;
    return NextResponse.json({
      has_overpayment: true,
      overpayment_amount: overpaymentAmount,
      total_collected: totalCollected,
      new_estimation_total: grandTotal,
      next_version: nextVersion
    });
  }

  return NextResponse.json({ has_overpayment: false });
}