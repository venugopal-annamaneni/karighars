import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

// GET: Fetch all base_rates for a project (active + history)
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = params;

  try {
    // Fetch all base_rates for this project with user names
    const result = await query(
      `SELECT 
        pbr.*,
        u_created.name AS created_by_name,
        u_approved.name AS approved_by_name,
        u_rejected.name AS rejected_by_name
       FROM project_base_rates pbr
       LEFT JOIN users u_created ON pbr.created_by = u_created.id
       LEFT JOIN users u_approved ON pbr.approved_by = u_approved.id
       LEFT JOIN users u_rejected ON pbr.rejected_by = u_rejected.id
       WHERE pbr.project_id = $1
       ORDER BY pbr.created_at DESC`,
      [projectId]
    );

    const allRates = result.rows;
    const activeRate = allRates.find(r => r.active === true);
    const history = allRates.filter(r => r.id !== activeRate?.id);

    return NextResponse.json({
      activeRate: activeRate || null,
      history: history
    });
  } catch (error) {
    console.error('Error fetching base rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch base rates' },
      { status: 500 }
    );
  }
}

// POST: Create or update requested base_rate
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = params;
  const body = await request.json();

  // Validation
  if (!body.category_rates || !body.category_rates.categories || !Array.isArray(body.category_rates.categories)) {
    return NextResponse.json(
      { error: 'Invalid category_rates structure' },
      { status: 400 }
    );
  }

  if (!body.gst_percentage) {
    return NextResponse.json(
      { error: 'GST percentage is required' },
      { status: 400 }
    );
  }

  try {
    // Check if project exists
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if there's already a pending request
    const pendingCheck = await query(
      `SELECT id FROM project_base_rates 
       WHERE project_id = $1 AND status = 'requested'
       LIMIT 1`,
      [projectId]
    );

    if (pendingCheck.rows.length > 0) {
      // UPDATE existing pending request
      const existingId = pendingCheck.rows[0].id;
      
      const updateResult = await query(
        `UPDATE project_base_rates SET
          category_rates = $1,
          gst_percentage = $2,
          comments = $3,
          updated_at = now()
         WHERE id = $4
         RETURNING *`,
        [
          JSON.stringify(body.category_rates),
          body.gst_percentage,
          body.comments || null,
          existingId
        ]
      );

      // Log activity
      await query(
        `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [projectId, 'project_base_rates', session.user.id, 'updated', 'Updated pending base rate request']
      );

      return NextResponse.json({
        message: 'Base rate request updated successfully',
        baseRate: updateResult.rows[0]
      });
    } else {
      // CREATE new requested entry
      const insertResult = await query(
        `INSERT INTO project_base_rates (
          project_id,
          category_rates,
          gst_percentage,
          status,
          active,
          created_by,
          comments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          projectId,
          JSON.stringify(body.category_rates),
          body.gst_percentage,
          'requested',
          false,
          session.user.id,
          body.comments || null
        ]
      );

      // Log activity
      await query(
        `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [projectId, 'project_base_rates', session.user.id, 'created', 'Submitted base rate change request']
      );

      return NextResponse.json({
        message: 'Base rate request submitted successfully',
        baseRate: insertResult.rows[0]
      });
    }
  } catch (error) {
    console.error('Error creating/updating base rate request:', error);
    return NextResponse.json(
      { error: 'Failed to submit base rate request' },
      { status: 500 }
    );
  }
}
