import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  
  const result = await query(`
          SELECT p.*, 
                 c.name as customer_name, 
                 u.name as created_by_name,
                 e.final_value,
                 e.gst_amount,
                 (e.final_value + COALESCE(e.gst_amount, 0)) as estimated_value_with_gst
          FROM projects p
          LEFT JOIN customers c ON p.customer_id = c.id
          LEFT JOIN users u ON p.created_by = u.id
          LEFT JOIN LATERAL (
            SELECT final_value, gst_amount 
            FROM project_estimations 
            WHERE project_id = p.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) e ON true
          ORDER BY p.created_at DESC
        `);
  return NextResponse.json({ projects: result.rows });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }


  const body = await request.json();
  const projectCode = `KG-${Date.now()}`;
  const salesOrderId = `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Use provided bizModel or default to V1
  let bizModelId = body.biz_model_id ? parseInt(body.biz_model_id) : null;
  if (!bizModelId) {
    const bizModelRes = await query(
      "SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1' AND is_active = true LIMIT 1"
    );
    bizModelId = bizModelRes.rows[0]?.id || null;
  }

  // Fetch first stage from biz_model_stages for the selected bizModel - REQUIRED
  if (!bizModelId) {
    return NextResponse.json(
      { error: 'Business model is required to create a project' },
      { status: 400 }
    );
  }

  const stageRes = await query(
    'SELECT stage_code FROM biz_model_stages WHERE biz_model_id = $1 ORDER BY sequence_order ASC LIMIT 1',
    [bizModelId]
  );

  if (stageRes.rows.length === 0) {
    return NextResponse.json(
      { error: 'Business model must have at least one stage defined' },
      { status: 400 }
    );
  }

  const initialStage = stageRes.rows[0].stage_code;

  const result = await query(
    `INSERT INTO projects (project_code, customer_id, name, location, stage, biz_model_id, sales_order_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [projectCode, body.customer_id, body.name, body.location, initialStage, bizModelId, salesOrderId, session.user.id]
  );

  // Log activity
  await query(
    `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
           VALUES ($1, $2, $3, $4, $5)`,
    [result.rows[0].id, 'projects', session.user.id, 'created', `Project created: ${body.name}`]
  );

  return NextResponse.json({ project: result.rows[0] });
}