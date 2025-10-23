import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

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
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await query(
      `INSERT INTO biz_models (code, name, description, service_charge_percentage, max_service_charge_discount_percentage,design_charge_percentage,max_design_charge_discount_percentage,shopping_charge_percentage,max_shopping_charge_discount_percentage, is_active, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [body.code, body.name, body.description, body.service_charge_percentage, body.max_service_charge_discount_percentage, body.design_charge_percentage, body.max_design_charge_discount_percentage, body.shopping_charge_percentage, body.max_shopping_charge_discount_percentage, body.is_active, body.status || 'draft']
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