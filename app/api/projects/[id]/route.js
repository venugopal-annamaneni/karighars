import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const result = await query(`
          SELECT p.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
                 u.name as created_by_name, bm.name as biz_model_name, bm.version as biz_model_version
          FROM projects p
          LEFT JOIN customers c ON p.customer_id = c.id
          LEFT JOIN users u ON p.created_by = u.id
          LEFT JOIN biz_models bm ON p.biz_model_id = bm.id
          WHERE p.id = $1
        `, [projectId]);

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get latest estimation
  const estResult = await query(`
          SELECT * FROM project_estimations
          WHERE project_id = $1
          ORDER BY version DESC
          LIMIT 1
        `, [projectId]);

  // Get payment summary (only approved payments)
  const paymentsIn = await query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM customer_payments
          WHERE project_id = $1 AND status = 'approved'
        `, [projectId]);

  const paymentsOut = await query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments_out
          WHERE project_id = $1
        `, [projectId]);

  return NextResponse.json({
    project: result.rows[0],
    estimation: estResult.rows[0] || null,
    payments_received: parseFloat(paymentsIn.rows[0]?.total || 0),
    payments_made: parseFloat(paymentsOut.rows[0]?.total || 0),
  });
}


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

    const projectId = params.id;

    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (body.name) {
      updates.push(`name = $${paramCounter++}`);
      values.push(body.name);
    }
    if (body.location) {
      updates.push(`location = $${paramCounter++}`);
      values.push(body.location);
    }
    if (body.stage) {
      updates.push(`stage = $${paramCounter++}`);
      values.push(body.stage);
    }
    if (body.status) {
      updates.push(`status = $${paramCounter++}`);
      values.push(body.status);
    }
    if (body.invoice_url !== undefined) {
      updates.push(`invoice_url = $${paramCounter++}`);
      values.push(body.invoice_url);
      if (body.invoice_url) {
        updates.push(`invoice_uploaded_at = NOW()`);
      }
    }
    if (body.revenue_realized !== undefined) {
      updates.push(`revenue_realized = $${paramCounter++}`);
      values.push(body.revenue_realized);
    }

    values.push(projectId);

    console.log(values);

    const result = await query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`,
      values
    );

    // Log stage change
    if (body.stage) {
      await query(
        `INSERT INTO project_status_history (project_id, new_status, changed_by, remarks)
           VALUES ($1, $2, $3, $4)`,
        [projectId, body.stage, session.user.id, body.remarks || '']
      );
    }

    return NextResponse.json({ project: result.rows[0] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }


  try {
    const projectId = params.id;
    await query(
      `UPDATE projects SET status = 'archived' WHERE id = $1`,
      [projectId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}