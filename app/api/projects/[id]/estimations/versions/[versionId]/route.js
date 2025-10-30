import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const version = parseInt(params.version);

  if (isNaN(version)) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }

  try {
    // Get estimation record for this version
    const estimationRes = await query(`
      SELECT 
        pe.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM project_estimations pe
      LEFT JOIN users u ON pe.uploaded_by = u.id
      WHERE pe.project_id = $1 AND pe.version = $2
    `, [projectId, version]);

    if (estimationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const estimation = estimationRes.rows[0];

    // Get items for this version
    const itemsRes = await query(`
      SELECT *
      FROM estimation_items
      WHERE estimation_id = $1
      ORDER BY room_name ASC, category ASC, created_at ASC
    `, [estimation.id]);

    return NextResponse.json({
      estimation: {
        id: estimation.id,
        version: estimation.version,
        source: estimation.source,
        is_active: estimation.is_active,
        csv_file_path: estimation.csv_file_path,
        created_at: estimation.created_at,
        created_by: estimation.created_by_name || estimation.created_by_email || 'Unknown',
        category_breakdown: estimation.category_breakdown,
        items_value: parseFloat(estimation.items_value) || 0,
        items_discount: parseFloat(estimation.items_discount) || 0,
        kg_charges: parseFloat(estimation.kg_charges) || 0,
        kg_charges_discount: parseFloat(estimation.kg_charges_discount) || 0,
        gst_amount: parseFloat(estimation.gst_amount) || 0,
        final_value: parseFloat(estimation.final_value) || 0
      },
      items: itemsRes.rows,
      items_count: itemsRes.rows.length
    });

  } catch (error) {
    console.error('Version details error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch version details', 
      message: error.message 
    }, { status: 500 });
  }
}
