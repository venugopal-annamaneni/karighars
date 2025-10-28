import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { BIZMODEL_STATUS, USER_ROLE } from '@/app/constants';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {searchParams} = new URL(request.url);
  const pageNo = Number(searchParams.get("page_no") || 1);
  const pageSize = Number(searchParams.get("page_size") || 20);
  const offset = (pageNo - 1) * pageSize;

  try {
    const result = await query(`
            SELECT * FROM biz_models WHERE is_active = true LIMIT $1 OFFSET $2
          `, [pageSize, offset]);
    return NextResponse.json({ bizModels: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();

  try {
    if (session.user.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate category_rates structure
    if (!body.category_rates || !body.category_rates.categories || !Array.isArray(body.category_rates.categories)) {
      return NextResponse.json({ error: 'Invalid category_rates structure' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO biz_models (code, name, description, gst_percentage, category_rates, is_active, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        body.code, 
        body.name, 
        body.description, 
        body.gst_percentage || 18,
        JSON.stringify(body.category_rates),
        body.is_active, 
        body.status || BIZMODEL_STATUS.DRAFT
      ]
    );

    // Add stages if provided
    if (body.stages && body.stages.length > 0) {
      for (const stage of body.stages) {
        await query(
          `INSERT INTO biz_model_stages (biz_model_id, stage_code, stage_name, sequence_order, description)
             VALUES ($1, $2, $3, $4, $5)`,
          [result.rows[0].id, stage.stage_code, stage.stage_name, stage.sequence_order, stage.description]
        );
      }
    }

    // Add milestones if provided
    if (body.milestones && body.milestones.length > 0) {
      for (const milestone of body.milestones) {
        await query(
          `INSERT INTO biz_model_milestones (biz_model_id, milestone_code, milestone_name, direction, stage_code, description, sequence_order, woodwork_percentage, misc_percentage)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [result.rows[0].id, milestone.milestone_code, milestone.milestone_name, milestone.direction,
          milestone.stage_code, milestone.description, milestone.sequence_order,
          milestone.woodwork_percentage || 0, milestone.misc_percentage || 0]
        );
      }
    }

    return NextResponse.json({ bizModel: result.rows[0] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}