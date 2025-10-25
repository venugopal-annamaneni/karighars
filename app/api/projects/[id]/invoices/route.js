import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { DOCUMENT_TYPE, INVOICE_RECORD_TYPE, INVOICE_STATUS } from '@/app/constants';

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
        u1.name as created_by_name
      FROM project_invoices pi
      LEFT JOIN users u1 ON pi.created_by = u1.id
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
    if (!body.amount || parseFloat(body.amount) === 0) {
      return NextResponse.json({ error: 'Amount cannot be zero' }, { status: 400 });
    }

    if (!body.document_url) {
      return NextResponse.json({ error: 'Document is required' }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO project_invoices (
        project_id, document_number, amount, record_type, document_date,
        document_url, remarks, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      projectId,
      body.document_number,
      body.amount,
      body.record_type,
      body.document_date || new Date(),
      body.document_url,
      body.remarks || null,
      INVOICE_STATUS.APPROVED,
      session.user.id
    ]);

    // Update Project table
    await query(`
      UPDATE projects
      SET invoiced_amount = COALESCE(invoiced_amount, 0) + $1
      WHERE id = $2
    `, [body.amount, projectId]);

    // Insert document into documents table
    await query(`INSERT INTO documents (group_type, group_id, related_entity, related_id, document_type, document_url, file_name, file_size, mime_type, uploaded_by, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      ["project", projectId, "project_invoices", body.related_id, body.document_type, body.document_url,
        body.file_name, body.file_size, body.mime_type, session.user.id,
        body.remarks || null]
    );

    // Log activity
    await query(`
      INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      projectId,
      'project_invoices',
      result.rows[0].id,
      session.user.id,
      `${body.record_type} Uploaded`,
      `Invoice uploaded: ${body.document_number || 'N/A'} - ₹${body.amount}`
    ]);

    return NextResponse.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
