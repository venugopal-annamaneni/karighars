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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const bizModelId = params.id || body.id; // supports both /api/biz-models/:id and body.id

  if (!bizModelId) {
    return NextResponse.json({ error: "Missing bizModel ID" }, { status: 400 });
  }
  const {searchParams} = new URL(request.url);
  const action = searchParams.get("action");
  
  try {
    if (action === 'toggle-status') {
      // Get current BizModel
      const currentModel = await query('SELECT * FROM biz_models WHERE id = $1', [bizModelId]);

      if (currentModel.rows.length === 0) {
        return NextResponse.json({ error: 'BizModel not found' }, { status: 404 });
      }

      const countProjectsRes = await query(
        `SELECT COUNT(p.id) AS project_count
        FROM projects p
        WHERE p.biz_model_id = $1`,
        [bizModelId]
      );
      
      if( parseInt(countProjectsRes.rows[0].project_count) > 0) {
        return NextResponse.json({ error: `Business Model is used in ${countProjectsRes.rows[0].project_count} projects. This action cannot be done.` }, { status: 404 });
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
    }

    // ✅ 1. Update main biz_model
    const updateRes = await query(
      `UPDATE biz_models
       SET code = $1,
           name = $2,
           description = $3,
           service_charge_percentage = $4,
           max_service_charge_discount_percentage = $5,
           design_charge_percentage = $6,
           max_design_charge_discount_percentage = $7,
           shopping_charge_percentage = $8,
           max_shopping_charge_discount_percentage = $9,
           is_active = $10,
           status = $11,
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        body.code,
        body.name,
        body.description,
        body.service_charge_percentage,
        body.max_service_charge_discount_percentage,
        body.design_charge_percentage,
        body.max_design_charge_discount_percentage,
        body.shopping_charge_percentage,
        body.max_shopping_charge_discount_percentage,
        body.is_active,
        body.status || "draft",
        bizModelId,
      ]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: "Biz model not found" }, { status: 404 });
    }

    const updatedModel = updateRes.rows[0];

    // ✅ 2. Update stages (if provided)
    if (Array.isArray(body.stages)) {
      // Clear old stages
      await query(`DELETE FROM biz_model_stages WHERE biz_model_id = $1`, [bizModelId]);

      // Insert new stages
      for (const stage of body.stages) {
        await query(
          `INSERT INTO biz_model_stages (biz_model_id, stage_code, stage_name, sequence_order, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            bizModelId,
            stage.stage_code,
            stage.stage_name,
            stage.sequence_order,
            stage.description,
          ]
        );
      }
    }

    // ✅ 3. Update milestones (if provided)
    if (Array.isArray(body.milestones)) {
      // Clear old milestones
      await query(`DELETE FROM biz_model_milestones WHERE biz_model_id = $1`, [bizModelId]);

      // Insert new milestones
      for (const milestone of body.milestones) {
        await query(
          `INSERT INTO biz_model_milestones (
              biz_model_id, milestone_code, milestone_name, direction,
              stage_code, description, sequence_order, woodwork_percentage, misc_percentage
            )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            bizModelId,
            milestone.milestone_code,
            milestone.milestone_name,
            milestone.direction,
            milestone.stage_code,
            milestone.description,
            milestone.sequence_order,
            milestone.woodwork_percentage || 0,
            milestone.misc_percentage || 0,
          ]
        );
      }
    }

    return NextResponse.json({ bizModel: updatedModel });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



