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
        SELECT vp.*, v.name as vendor_name, p.name as project_name, u.name as created_by_name
        FROM payments_out vp
        LEFT JOIN vendors v ON vp.vendor_id = v.id
        LEFT JOIN projects p ON vp.project_id = p.id
        LEFT JOIN users u ON vp.created_by = u.id
      `;
    const queryParams = [];

    if (projectId) {
      queryText += ' WHERE vp.project_id = $1';
      queryParams.push(projectId);
    }

    queryText += ' ORDER BY vp.payment_date DESC';

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

  try {
    const result = await query(
      `INSERT INTO payments_out (project_id, vendor_id, vendor_boq_id, payment_stage, amount, payment_date, mode, reference_number, remarks, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [body.project_id, body.vendor_id, body.vendor_boq_id, body.payment_stage, body.amount,
      body.payment_date || new Date(), body.mode, body.reference_number, body.remarks, session.user.id]
    );

    // Create ledger entry
    await query(
      `INSERT INTO project_ledger (project_id, source_table, source_id, entry_type, amount, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
      [body.project_id, 'payments_out', result.rows[0].id, 'debit', body.amount, body.remarks]
    );

    return NextResponse.json({ payment: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}