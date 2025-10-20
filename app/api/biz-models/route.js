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
    const result = await query(`
            SELECT * FROM biz_models WHERE is_active = true ORDER BY version
          `);
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

    // Auto-generate version
    let version = body.version;

    if (body.is_editing && body.base_model_id) {
      // Editing: Get the base model's version and increment
      const baseModel = await query('SELECT version FROM biz_models WHERE id = $1', [body.base_model_id]);
      if (baseModel.rows.length > 0) {
        const currentVersion = baseModel.rows[0].version;

        // Extract version number and increment
        const versionMatch = currentVersion.match(/V?(\d+)$/i);
        if (versionMatch) {
          const num = parseInt(versionMatch[1]);
          version = `V${num + 1}`;
        } else {
          version = 'V2'; // Default if can't parse
        }
      }
    } else if (!version) {
      // New model: Check if code already exists, get max version
      const existing = await query(
        `SELECT version FROM biz_models WHERE code = $1 ORDER BY created_at DESC LIMIT 1`,
        [body.code]
      );

      if (existing.rows.length > 0) {
        const currentVersion = existing.rows[0].version;
        const versionMatch = currentVersion.match(/V?(\d+)$/i);
        if (versionMatch) {
          const num = parseInt(versionMatch[1]);
          version = `V${num + 1}`;
        } else {
          version = 'V2';
        }
      } else {
        version = 'V1'; // First version
      }
    }

    const result = await query(
      `INSERT INTO biz_models (code, name, version, description, service_charge_percentage, max_discount_percentage, is_active, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [body.code, body.name, version, body.description, body.service_charge_percentage, body.max_discount_percentage, body.is_active, body.status || 'draft']
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

