import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

// GET - Fetch all invoices for a project
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projectId = params.id;

    const result = await query(`
      SELECT 
        pi.*,
        u1.name as uploaded_by_name,
        u2.name as approved_by_name,
        u3.name as cancelled_by_name
      FROM project_invoices pi
      LEFT JOIN users u1 ON pi.uploaded_by = u1.id
      LEFT JOIN users u2 ON pi.approved_by = u2.id
      LEFT JOIN users u3 ON pi.cancelled_by = u3.id
      WHERE pi.project_id = $1
      ORDER BY pi.created_at DESC
    `, [projectId]);

    return NextResponse.json({ invoices: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Upload new invoice
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Finance and Admin can upload invoices
  if (session.user.role !== 'finance' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Only Finance and Admin can upload invoices' }, { status: 403 });
  }

  try {
    const projectId = params.id;
    const body = await request.json();

    // Validation
    if (!body.invoice_amount || parseFloat(body.invoice_amount) <= 0) {
      return NextResponse.json({ error: 'Invoice amount must be greater than 0' }, { status: 400 });
    }

    if (!body.invoice_document_url) {
      return NextResponse.json({ error: 'Invoice document is required' }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO project_invoices (
        project_id, invoice_number, invoice_amount, invoice_date,
        invoice_document_url, remarks, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      projectId,
      body.invoice_number || null,
      body.invoice_amount,
      body.invoice_date || new Date(),
      body.invoice_document_url,
      body.remarks || null,
      session.user.id
    ]);

    // Log activity
    await query(`
      INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      projectId,
      'project_invoices',
      result.rows[0].id,
      session.user.id,
      'invoice_uploaded',
      `Invoice uploaded: ${body.invoice_number || 'N/A'} - ₹${body.invoice_amount}`
    ]);

    return NextResponse.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
