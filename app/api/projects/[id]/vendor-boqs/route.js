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
    const projectId = params.id;
    let queryText = `
        SELECT vb.*, v.name as vendor_name, p.name as project_name
        FROM vendor_boqs vb
        LEFT JOIN vendors v ON vb.vendor_id = v.id
        LEFT JOIN projects p ON vb.project_id = p.id
      `;
    const queryParams = [];

    if (projectId) {
      queryText += ' WHERE vb.project_id = $1';
      queryParams.push(projectId);
    }

    queryText += ' ORDER BY vb.created_at DESC';

    const result = await query(queryText, queryParams);
    return NextResponse.json({ boqs: result.rows });
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
    const boqCode = `BOQ-${Date.now()}`;
    const result = await query(
      `INSERT INTO vendor_boqs (project_id, vendor_id, boq_code, total_value, margin_percentage, status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.project_id, body.vendor_id, boqCode, body.total_value, body.margin_percentage,
      body.status || 'draft', body.remarks]
    );

    // Add BOQ items if provided
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        await query(
          `INSERT INTO vendor_boq_items (boq_id, estimation_item_id, description, quantity, unit, vendor_rate)
             VALUES ($1, $2, $3, $4, $5, $6)`,
          [result.rows[0].id, item.estimation_item_id, item.description, item.quantity, item.unit, item.vendor_rate]
        );
      }
    }

    return NextResponse.json({ boq: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


