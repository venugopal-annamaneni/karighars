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
    const bizModelId = params.id;


    const [modelRes, stagesRes, milestonesRes] = await Promise.all([
      query('SELECT * FROM biz_models WHERE id = $1', [bizModelId]),
      query('SELECT * FROM biz_model_stages WHERE biz_model_id = $1 ORDER BY sequence_order', [bizModelId]),
      query('SELECT * FROM biz_model_milestones WHERE biz_model_id = $1 ORDER BY direction, sequence_order', [bizModelId])
    ]);

    if (modelRes.rows[0]) {
      return NextResponse.json({
        model: modelRes.rows[0],
        stages: stagesRes.rows,
        milestones: milestonesRes.rows
      });
    } else {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);

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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const bizModelId = params.id;
    const action = searchParams.get("action");

    if (action === 'toggle-status') {
      // Get current BizModel
      const currentModel = await query('SELECT * FROM biz_models WHERE id = $1', [bizModelId]);

      if (currentModel.rows.length === 0) {
        return NextResponse.json({ error: 'BizModel not found' }, { status: 404 });
      }

      const currentStatus = currentModel.rows[0].status;
      const newStatus = currentStatus === 'draft' ? 'published' : 'draft';

      // Update status
      const result = await query(
        `UPDATE biz_models 
         SET status = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [newStatus, bizModelId]
      );

      return NextResponse.json({
        bizModel: result.rows[0],
        message: `BizModel status changed from ${currentStatus} to ${newStatus}`
      });
    } else {
      console.error('API Error:', error);
      return NextResponse.json({ error: "Invalid Reqiest" }, { status: 400 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

}



