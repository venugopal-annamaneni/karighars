import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageNo = Number(searchParams.get("page_no") || 1);
  const pageSize = Number(searchParams.get("page_size") || 20);
  const offset = (pageNo - 1) * pageSize;

  const filter = searchParams.get("filter")?.trim() || "";
  const filterValue = `%${filter}%`;


  const result = await query(`
          SELECT 
            p.*,
            c.name AS customer_name,
            u.name AS created_by_name,
            e.final_value,
            COUNT(*) OVER() AS total_records
          FROM projects p
          LEFT JOIN customers c ON p.customer_id = c.id
          LEFT JOIN users u ON p.created_by = u.id
          LEFT JOIN LATERAL (
            SELECT final_value
            FROM project_estimations 
            WHERE project_id = p.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) e ON TRUE 
           WHERE 
          ($3 = '' OR 
            p.project_code ILIKE $4 OR 
            c.name ILIKE $4 OR 
            p.location ILIKE $4
          )
          ORDER BY p.created_at DESC
          LIMIT $1 OFFSET $2
        `, [pageSize, offset,filter, filterValue]);
  return NextResponse.json({ projects: result.rows });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }


  const body = await request.json();
  
  // Validate project_code is provided
  if (!body.project_code) {
    return NextResponse.json(
      { error: 'Project code is required' },
      { status: 400 }
    );
  }
  
  const projectCode = body.project_code;
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

  try {
    // Start transaction
    await query('BEGIN');

    // Step 1: Create project (without base_rate_id initially)
    const projectResult = await query(
      `INSERT INTO projects (project_code, customer_id, name, location, stage, biz_model_id, sales_order_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [projectCode, body.customer_id, body.name, body.location, initialStage, bizModelId, salesOrderId, session.user.id]
    );

    const newProject = projectResult.rows[0];

    // Step 2: Fetch biz_model rates (category_rates JSONB)
    const bizModelResult = await query(
      `SELECT category_rates, gst_percentage FROM biz_models WHERE id = $1`,
      [bizModelId]
    );

    if (bizModelResult.rows.length === 0) {
      throw new Error('Business model not found');
    }

    const bizModel = bizModelResult.rows[0];

    // Step 3: Create base_rate entry (approved and active) with category_rates
    const baseRateResult = await query(
      `INSERT INTO project_base_rates (
        project_id,
        category_rates,
        gst_percentage,
        status,
        active,
        created_by,
        approved_by,
        approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`,
      [
        newProject.id,
        bizModel.category_rates,
        bizModel.gst_percentage,
        'approved',
        true,
        session.user.id,
        session.user.id
      ]
    );

    const baseRateId = baseRateResult.rows[0].id;

    // Step 4: Update project with base_rate_id
    await query(
      'UPDATE projects SET base_rate_id = $1 WHERE id = $2',
      [baseRateId, newProject.id]
    );

    // Step 5: Log activity
    await query(
      `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [newProject.id, 'projects', session.user.id, 'created', `Project created: ${body.name}`]
    );

    // Commit transaction
    await query('COMMIT');

    // Return project with base_rate_id
    const finalProjectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [newProject.id]
    );

    return NextResponse.json({ project: finalProjectResult.rows[0] });
  } catch (error) {
    // Rollback on error
    await query('ROLLBACK');
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project: ' + error.message },
      { status: 500 }
    );
  }
}