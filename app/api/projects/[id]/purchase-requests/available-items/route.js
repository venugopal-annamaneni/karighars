import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

// GET /api/projects/[id]/purchase-requests/available-items
// Returns estimation items with fulfillment calculation via junction table
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // Get active estimation for project
    const estimationResult = await query(`
      SELECT id FROM project_estimations
      WHERE project_id = $1 AND is_active = true
      LIMIT 1
    `, [projectId]);

    if (estimationResult.rows.length === 0) {
      return NextResponse.json({
        items: [],
        message: 'No active estimation found for this project'
      });
    }

    const estimationId = estimationResult.rows[0].id;

    // Calculate fulfilled quantity using junction table with weightage
    // Separate confirmed and draft allocations
    const items = await query(`
      SELECT 
        ei.id,
        ei.category,
        ei.room_name,
        ei.item_name,
        ei.quantity as total_qty,
        ei.unit,
        ei.width,
        ei.height,
        COALESCE(
          SUM(
            prel.linked_qty * prel.unit_purchase_request_item_weightage
          ) FILTER (
            WHERE pr.status = 'confirmed' AND pri.active = true
          ), 
          0
        ) as confirmed_qty,
        COALESCE(
          SUM(
            prel.linked_qty * prel.unit_purchase_request_item_weightage
          ) FILTER (
            WHERE pr.status = 'draft' AND pri.active = true
          ), 
          0
        ) as draft_qty,
        (
          ei.quantity - COALESCE(
            SUM(
              prel.linked_qty * prel.unit_purchase_request_item_weightage
            ) FILTER (
              WHERE pr.status = 'confirmed' AND pri.active = true
            ), 
            0
          )
        ) as available_qty
      FROM estimation_items ei
      LEFT JOIN purchase_request_estimation_links prel 
        ON ei.id = prel.estimation_item_id
      LEFT JOIN purchase_request_items pri 
        ON prel.purchase_request_item_id = pri.id
      LEFT JOIN purchase_requests pr 
        ON pri.purchase_request_id = pr.id
      WHERE ei.estimation_id = $1
      GROUP BY ei.id
      ORDER BY ei.category, ei.room_name, ei.item_name
    `, [estimationId]);

    // Group by category
    const groupedByCategory = {};
    items.rows.forEach(item => {
      if (!groupedByCategory[item.category]) {
        groupedByCategory[item.category] = [];
      }
      groupedByCategory[item.category].push({
        ...item,
        total_qty: parseFloat(item.total_qty),
        confirmed_qty: parseFloat(item.confirmed_qty),
        draft_qty: parseFloat(item.draft_qty),
        available_qty: parseFloat(item.available_qty)
      });
    });

    return NextResponse.json({
      estimation_id: estimationId,
      items: items.rows.map(item => ({
        ...item,
        total_qty: parseFloat(item.total_qty),
        confirmed_qty: parseFloat(item.confirmed_qty),
        draft_qty: parseFloat(item.draft_qty),
        available_qty: parseFloat(item.available_qty)
      })),
      grouped_by_category: groupedByCategory,
      total_count: items.rows.length
    });

  } catch (error) {
    console.error('Error fetching available items:', error);
    return NextResponse.json({
      error: 'Failed to fetch available items',
      message: error.message
    }, { status: 500 });
  }
}
