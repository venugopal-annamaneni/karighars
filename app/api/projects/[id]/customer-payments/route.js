import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

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
  const isCreditNote = body.payment_type === 'CREDIT_NOTE';

  try {
    // 1️⃣ Permission check
    if (isCreditNote && session.user.role !== 'admin' && session.user.role !== 'finance') {
      return NextResponse.json({ error: 'Forbidden - Admin/Finance only' }, { status: 403 });
    }

    // 2️⃣ Handle Credit Note creation
    if (isCreditNote) {
      const projectId = body.project_id;
      const estRes = await query(`
        SELECT e.*, p.customer_id, p.id AS project_id
        FROM project_estimations e
        JOIN projects p ON e.project_id = p.id
        WHERE p.id = $1
        ORDER BY e.version DESC
        LIMIT 1
      `, [projectId]);

      if (estRes.rows.length === 0) {
        return NextResponse.json({ error: 'Estimation not found' }, { status: 404 });
      }

      const estimation = estRes.rows[0];
      if (!estimation.has_overpayment) {
        return NextResponse.json({ error: 'No overpayment detected for this estimation' }, { status: 400 });
      }

      const creditNoteResult = await query(`
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
        'CREDIT_NOTE',
        -Math.abs(estimation.overpayment_amount),
        new Date(),
        'other',
        `CREDIT-NOTE-${projectId}`,
        `Credit note for estimation v${estimation.version}. Overpayment: ₹${estimation.overpayment_amount}`,
        'pending',
        session.user.id
      ]);

      return NextResponse.json({
        message: 'Credit note created in pending state. Finance must upload document.',
        credit_note: creditNoteResult.rows[0],
        overpayment_amount: estimation.overpayment_amount
      });
    }

<<<<<<< HEAD
    // 3️⃣ Handle Normal Payment creation
    let actualPercentage = null;
    if (body.estimation_id) {
      const estRes = await query(
        'SELECT final_value FROM project_estimations WHERE id = $1',
        [body.estimation_id]
      );
      if (estRes.rows.length > 0) {
        const total = parseFloat(estRes.rows[0].final_value);
        if (total > 0) {
          actualPercentage = (parseFloat(body.amount) / total) * 100;
        }
      }
    }

    const result = await query(
      `INSERT INTO customer_payments (
        project_id, estimation_id, customer_id, payment_type, milestone_id,
        actual_percentage, override_reason,
        amount, gst_amount, gst_percentage,
        payment_date, mode, reference_number, remarks, created_by,
        document_url, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
=======
    
    const result = await query(
      `INSERT INTO customer_payments (
        project_id, customer_id, payment_type, milestone_id,
        override_reason,
        amount, pre_tax_amount, gst_amount, gst_percentage,
        payment_date, mode, reference_number, remarks, created_by,
        document_url, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
>>>>>>> c9559a17bb320b213203133abe9887ab261defa3
      RETURNING *`,
      [
        body.project_id,
        body.customer_id,
        body.payment_type || 'REGULAR',
        body.milestone_id || null,
        body.override_reason || null,
        body.amount,
        body.gst_amount || 0,
        body.gst_percentage || 0,
        body.payment_date || new Date(),
        body.mode || 'bank',
        body.reference_number,
        body.remarks,
        session.user.id,
        body.document_url || null,
        body.status || 'pending'
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
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}