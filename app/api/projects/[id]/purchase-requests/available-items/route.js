import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { ESTIMATION_ITEM_STATUS } from '@/app/constants';

// GET /api/projects/[id]/purchase-requests/available-items
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // Get all estimation items with Queued status
    const result = await query(`
      SELECT 
        ei.id,
        ei.category,
        ei.room_name,
        ei.item_name,
        ei.quantity,
        ei.unit,
        ei.width,
        ei.height,
        ei.unit_price,
        ei.subtotal,
        ei.karighar_charges_amount,
        ei.item_discount_amount,
        ei.discount_kg_charges_amount,
        ei.gst_percentage,
        ei.gst_amount,
        ei.item_total,
        ei.status
      FROM estimation_items ei
      INNER JOIN project_estimations pe ON ei.estimation_id = pe.id
      WHERE pe.project_id = $1 
        AND ei.status = $2
        AND pe.is_active = true
      ORDER BY ei.category, ei.room_name, ei.item_name
    `, [projectId, ESTIMATION_ITEM_STATUS.QUEUED]);

    // Group by category for easier UI rendering
    const groupedByCategory = {};
    result.rows.forEach(item => {
      if (!groupedByCategory[item.category]) {
        groupedByCategory[item.category] = [];
      }
      groupedByCategory[item.category].push(item);
    });

    return NextResponse.json({
      items: result.rows,
      grouped_by_category: groupedByCategory,
      total_count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching available items:', error);
    return NextResponse.json({
      error: 'Failed to fetch available items',
      message: error.message
    }, { status: 500 });
  }
}
