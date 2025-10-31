import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';

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

    const estimationId = params.estimationId;

    // Get estimation details
    const estRes = await query(`
          SELECT * FROM project_estimations WHERE id = $1
        `, [estimationId]);

    if (estRes.rows.length === 0) {
      return NextResponse.json({ error: 'Estimation not found' }, { status: 404 });
    }

    const estimation = estRes.rows[0];

    // Check if user is the creator
    if (estimation.created_by !== session.user.id && session.user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: 'Only the creator or admin can cancel this estimation' }, { status: 403 });
    }

    // Delete the estimation to be reveted
    await query('DELETE FROM estimation_items WHERE estimation_id = $1', [estimationId]);
    await query('DELETE FROM project_estimations WHERE id = $1', [estimationId]);

    // Get the previous version and mark it as active
    const prevVersionRes = await query(`
          SELECT * FROM project_estimations 
          WHERE project_id = $1 AND version = $2
          ORDER BY id DESC LIMIT 1
        `, [estimation.project_id, estimation.version - 1]);

    if (prevVersionRes.rows.length > 0) {
      await query(`
            UPDATE project_estimations 
            SET updated_at = NOW()
            WHERE id = $1
          `, [prevVersionRes.rows[0].id]);
    }

    // Log activity
    await query(
      `INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
           VALUES ($1, $2, $3, $4, $5, $6)`,
      [estimation.project_id, 'project_estimations', estimationId, session.user.id, 'overpayment_cancelled',
      `Estimation v${estimation.version} cancelled, reverted to v${estimation.version - 1}`]
    );

    return NextResponse.json({
      success: true,
      message: 'Estimation cancelled and reverted to previous version',
      previous_version: prevVersionRes.rows[0]
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

}
