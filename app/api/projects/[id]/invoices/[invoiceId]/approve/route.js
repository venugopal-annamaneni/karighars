import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

// POST - Approve invoice
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Admin can approve invoices
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Only Admin can approve invoices' }, { status: 403 });
  }

  try {
    const { id: projectId, invoiceId } = params;

    // Get invoice details
    const invoiceRes = await query(`
      SELECT * FROM project_invoices
      WHERE id = $1 AND project_id = $2
    `, [invoiceId, projectId]);

    if (invoiceRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoiceRes.rows[0];

    if (invoice.status !== 'pending') {
      return NextResponse.json({ error: `Cannot approve invoice with status: ${invoice.status}` }, { status: 400 });
    }

    // Update invoice status to approved
    const updateResult = await query(`
      UPDATE project_invoices
      SET status = 'approved',
          approved_by = $1,
          approved_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [session.user.id, invoiceId]);

    // Update project's invoiced_amount
    await query(`
      UPDATE projects
      SET invoiced_amount = COALESCE(invoiced_amount, 0) + $1
      WHERE id = $2
    `, [invoice.invoice_amount, projectId]);

    // Insert document into documents table (for both invoices and credit notes)
    if (invoice.invoice_document_url) {
      const documentType = parseFloat(invoice.invoice_amount) < 0 ? 'credit_note' : 'invoice';
      await query(`
        INSERT INTO documents (
          project_id, document_type, document_url, document_name,
          source_table, source_id, uploaded_by, uploaded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT DO NOTHING
      `, [
        projectId,
        documentType,
        invoice.invoice_document_url,
        invoice.invoice_number || (documentType === 'credit_note' ? 'Credit Note' : 'Invoice'),
        'project_invoices',
        invoiceId,
        session.user.id
      ]);
    }

    // Log activity
    await query(`
      INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      projectId,
      'project_invoices',
      invoiceId,
      session.user.id,
      'invoice_approved',
      `Invoice approved: ${invoice.invoice_number || 'N/A'} - ₹${invoice.invoice_amount}`
    ]);

    return NextResponse.json({ 
      invoice: updateResult.rows[0],
      message: 'Invoice approved successfully'
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
