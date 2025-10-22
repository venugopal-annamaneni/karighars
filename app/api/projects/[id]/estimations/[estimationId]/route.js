import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const path = params.path ? params.path.join('/') : '';
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
  
  const estimationId = params.estimationId;
  const result = await query(
    `UPDATE project_estimations 
         SET total_value = $1, woodwork_value = $2, misc_internal_value = $3, misc_external_value = $4, 
             status = $5, remarks = $6, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
    [body.total_value, body.woodwork_value, body.misc_internal_value, body.misc_external_value,
    body.status, body.remarks, estimationId]
  );
  return NextResponse.json({ estimation: result.rows[0] });

}