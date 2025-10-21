import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

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

    const boqId = params.boqId;
    const result = await query(
      `UPDATE vendor_boqs 
         SET status = $1, total_value = $2, margin_percentage = $3, remarks = $4, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
      [body.status, body.total_value, body.margin_percentage, body.remarks, boqId]
    );

    // Log status change
    await query(
      `INSERT INTO vendor_boq_status_history (vendor_boq_id, new_status, changed_by, remarks)
         VALUES ($1, $2, $3, $4)`,
      [boqId, body.status, session.user.id, body.remarks || '']
    );

    return NextResponse.json({ boq: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

}
