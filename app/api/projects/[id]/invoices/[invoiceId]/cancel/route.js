import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

// POST - Cancel invoice
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Admin and Finance can cancel invoices
  if (session.user.role !== 'admin' && session.user.role !== 'finance') {
    return NextResponse.json({ error: 'Only Admin and Finance can cancel invoices' }, { status: 403 });
  }

  try {
    const { id: projectId, invoiceId } = params;
    const body = await request.json();

    if (!body.cancellation_reason) {
      return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });
    }

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
      return NextResponse.json({ error: `Cannot cancel invoice with status: ${invoice.status}` }, { status: 400 });
    }

    // Update invoice status to cancelled
    const updateResult = await query(`
      UPDATE project_invoices
      SET status = 'cancelled',
          cancelled_by = $1,
          cancelled_at = NOW(),
          cancellation_reason = $2
      WHERE id = $3
      RETURNING *
    `, [session.user.id, body.cancellation_reason, invoiceId]);

    // Log activity
    await query(`
      INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      projectId,
      'project_invoices',
      invoiceId,
      session.user.id,
      'invoice_cancelled',
      `Invoice cancelled: ${invoice.document_number || 'N/A'} - Reason: ${body.cancellation_reason}`
    ]);

    return NextResponse.json({ 
      invoice: updateResult.rows[0],
      message: 'Invoice cancelled successfully'
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
