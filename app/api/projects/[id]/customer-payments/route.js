import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PAYMENT_STATUS, REVERSAL_PAYMENT_TYPE, USER_ROLE } from '@/app/constants';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projectId = params.id;
    let queryText = `
        SELECT cp.*, 
               p.name as project_name, 
               c.name as customer_name, 
               u.name as created_by_name,
               approver.name as approved_by_name
        FROM customer_payments cp
        LEFT JOIN projects p ON cp.project_id = p.id
        LEFT JOIN customers c ON cp.customer_id = c.id
        LEFT JOIN users u ON cp.created_by = u.id
        LEFT JOIN users approver ON cp.approved_by = approver.id
      `;
    const queryParams = [];

    if (projectId) {
      queryText += ' WHERE cp.project_id = $1';
      queryParams.push(projectId);
    }

    queryText += ' ORDER BY cp.payment_date DESC';

    const result = await query(queryText, queryParams);
    return NextResponse.json({ payments: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const isReceiptReversal = body.payment_type === REVERSAL_PAYMENT_TYPE;

  try {
    // 1️⃣ Permission check
    if (isReceiptReversal && session.user.role !== USER_ROLE.ADMIN && session.user.role !== USER_ROLE.FINANCE) {
      return NextResponse.json({ error: 'Forbidden - Admin/Finance only' }, { status: 403 });
    }

    // 2️⃣ Handle Receipt Reversal creation
    if (isReceiptReversal) {
      const projectId = body.project_id;
      const estRes = await query(`
        SELECT e.*, p.customer_id, p.id AS project_id
        FROM project_estimations e
        JOIN projects p ON e.project_id = p.id
        WHERE p.id = $1
      `, [projectId]);

      if (estRes.rows.length === 0) {
        return NextResponse.json({ error: 'Estimation not found' }, { status: 404 });
      }

      const estimation = estRes.rows[0];
      if (!estimation.has_overpayment) {
        return NextResponse.json({ error: 'No overpayment detected for this estimation' }, { status: 400 });
      }

      const receiptReversalResult = await query(`
        INSERT INTO customer_payments (
          project_id, customer_id,
          payment_type, amount, payment_date, mode, reference_number,
          remarks, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        estimation.project_id,
        estimation.customer_id,
        body.payment_type,
        -Math.abs(estimation.overpayment_amount),
        new Date(),
        'NA',
        `${body.payment_type}-${projectId}`,
        `Receipt reversal for estimation v${estimation.version}. Overpayment: ₹${estimation.overpayment_amount}`,
        PAYMENT_STATUS.PENDING,
        session.user.id
      ]);

      return NextResponse.json({
        message: `Receipt reversal created in ${PAYMENT_STATUS.PENDING} state. Finance must upload document.`,
        receipt_reversal: receiptReversalResult.rows[0],
        overpayment_amount: estimation.overpayment_amount
      });
    } else {
      const result = await query(
        `INSERT INTO customer_payments (
        project_id, customer_id, payment_type, milestone_id,
        amount,
        payment_date, mode, reference_number, remarks, created_by,
        document_url, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
        [
          body.project_id,
          body.customer_id,
          body.payment_type,
          body.milestone_id || null,
          body.amount,
          body.payment_date || new Date(),
          body.mode,
          body.reference_number,
          body.remarks,
          session.user.id,
          body.document_url || null,
          body.status || PAYMENT_STATUS.PENDING
        ]
      );

      await query(
        `INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
       VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          body.project_id,
          'customer_payments',
          result.rows[0].id,
          session.user.id,
          'payment_recorded',
          `Payment recorded: ₹${body.amount} - Pending document upload`
        ]
      );
      return NextResponse.json({ payment: result.rows[0] });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}