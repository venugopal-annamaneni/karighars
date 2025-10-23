import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PAYMENT_STATUS, USER_ROLE } from '@/lib/constants';

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body only if request has content
  let body = {};
  try {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      body = await request.json();
    }
  } catch (error) {
    // No body or invalid JSON, use empty object
    body = {};
  }

  try {

    const paymentId = params.paymentId;

    // Check if user is Finance or Admin
    if (session.user.role !== 'finance' && session.user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: 'Only Finance team can approve payments' }, { status: 403 });
    }

    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (body.document_url !== undefined) {
      updates.push(`document_url = $${paramCounter++}`);
      values.push(body.document_url);
    }

    if (body.status !== undefined) {
      updates.push(`status = $${paramCounter++}`);
      values.push(body.status);

      if (body.status === PAYMENT_STATUS.APPROVED) {
        updates.push(`approved_by = $${paramCounter++}`);
        values.push(session.user.id);
        updates.push(`approved_at = NOW()`);
      }
    }

    values.push(paymentId);

    const result = await query(
      `UPDATE customer_payments SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`,
      values
    );

    if (body.status === PAYMENT_STATUS.APPROVED) {
      const payment = result.rows[0];

      // Determine ledger entry type
      const entryType = body.document_type === 'credit_note' ? 'debit' : 'credit';
      const remarks =
        body.document_type === 'credit_note'
          ? 'Credit note approved by Finance'
          : 'Payment approved by Finance';


      const ledgerCheck = await query(
        'SELECT id FROM project_ledger WHERE source_table = $1 AND source_id = $2',
        ['customer_payments', paymentId]
      );

      if (ledgerCheck.rows.length === 0) {
        await query(
          `INSERT INTO project_ledger (project_id, source_table, source_id, entry_type, amount, remarks)
            VALUES ($1, $2, $3, $4, $5, $6)`,
          [payment.project_id, 'customer_payments', paymentId, entryType, payment.amount, remarks]
        );
      }

      // Get the latest estimation id
      const latestEstRes = await query(
        `SELECT e.id
          FROM project_estimations e
          WHERE e.project_id = $1
          ORDER BY e.version DESC
          LIMIT 1`, [payment.project_id]
      )
      if(latestEstRes.rows.length == 0) {
        return NextResponse.json({ error: 'This project does not have a valid estimation' }, { status: 500 });
      }
      const estimationId = latestEstRes.rows[0].id;

      // Overpayment check
      const paymentsRes = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_collected
          FROM customer_payments
          WHERE project_id = $1 AND status = $2`,
        [payment.project_id, PAYMENT_STATUS.APPROVED]
      );

      const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);

      const estRes = await query(
        `SELECT final_value FROM project_estimations WHERE id = $1`,
        [estimationId]
      );

      if (estRes.rows.length > 0) {
        const grandTotal =
          parseFloat(estRes.rows[0].final_value);

        if (totalCollected > grandTotal) {
          const overpaymentAmount = totalCollected - grandTotal;

          await query(
            `UPDATE project_estimations
              SET has_overpayment = true,
              overpayment_amount = $1
              WHERE id = $2`,
            [overpaymentAmount, estimationId]
          );
        } else {
          await query(
            `UPDATE project_estimations
              SET has_overpayment = false,
              overpayment_amount = 0
              WHERE id = $1`,
            [estimationId]
          );
        }
      }
    }

    return NextResponse.json({ payment: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

}