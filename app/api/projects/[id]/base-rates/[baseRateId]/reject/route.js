import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is Admin
  if (session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json(
      { error: 'Only admins can reject base rate requests' },
      { status: 403 }
    );
  }

  const { id: projectId, baseRateId } = params;
  const body = await request.json();

  // Validation: Comments required for rejection
  if (!body.comments || body.comments.trim().length === 0) {
    return NextResponse.json(
      { error: 'Rejection reason is required' },
      { status: 400 }
    );
  }

  try {
    // Verify base_rate exists, is for this project, and is in requested status
    const baseRateCheck = await query(
      `SELECT id FROM project_base_rates 
       WHERE id = $1 AND project_id = $2 AND status = 'requested'`,
      [baseRateId, projectId]
    );

    if (baseRateCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Base rate request not found or not in pending status' },
        { status: 404 }
      );
    }

    // Update to rejected
    await query(
      `UPDATE project_base_rates SET
        status = 'rejected',
        active = false,
        rejected_by = $1,
        rejected_at = now(),
        comments = $2
       WHERE id = $3`,
      [session.user.id, body.comments, baseRateId]
    );

    // Log activity
    await query(
      `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, 'project_base_rates', session.user.id, 'rejected', `Rejected base rate request: ${body.comments}`]
    );

    return NextResponse.json({
      message: 'Base rate request rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting base rate:', error);
    return NextResponse.json(
      { error: 'Failed to reject base rate request' },
      { status: 500 }
    );
  }
}
