import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';

// GET /api/projects/[id]/purchase-requests/[prId] - Get PR details with links
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, prId } = params;

  try {
    // Get PR details
    const prResult = await query(`
      SELECT 
        pr.*,
        v.name as vendor_name,
        v.contact_person,
        v.phone as vendor_phone,
        v.email as vendor_email,
        u.name as created_by_name
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN project_estimations pe ON pr.estimation_id = pe.id
      WHERE pr.id = $1 AND pr.project_id = $2
    `, [prId, projectId]);

    if (prResult.rows.length === 0) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 });
    }

    // Get PR items with their estimation links and pricing
    const itemsResult = await query(`
      SELECT 
        pri.id,
        pri.stable_item_id,
        pri.purchase_request_item_name,
        pri.category,
        pri.room_name,
        pri.quantity,
        pri.width,
        pri.height,
        pri.unit,
        pri.unit_price,
        pri.subtotal,
        pri.gst_percentage,
        pri.gst_amount,
        pri.amount_before_gst,
        pri.item_total,
        pri.is_direct_purchase,
        pri.status,
        pri.lifecycle_status,
        pri.created_at,
        pri.created_by,
        json_agg(
          json_build_object(
            'id', prel.id,
            'stable_estimation_item_id', prel.stable_estimation_item_id,
            'estimation_item_name', ei.item_name,
            'estimation_item_category', ei.category,
            'estimation_item_room', ei.room_name,
            'estimation_item_unit', ei.unit,
            'estimation_item_width', ei.width,
            'estimation_item_height', ei.height,
            'linked_qty', prel.linked_qty,
            'weightage', prel.unit_purchase_request_item_weightage,
            'notes', prel.notes
          )
        ) FILTER (WHERE prel.id IS NOT NULL) as estimation_links
      FROM purchase_request_items pri
      LEFT JOIN purchase_request_estimation_links prel ON pri.stable_item_id = prel.stable_item_id
      LEFT JOIN estimation_items ei ON prel.stable_estimation_item_id = ei.stable_item_id
      WHERE pri.purchase_request_id = $1
      GROUP BY pri.id
      ORDER BY pri.id
    `, [prId]);

    return NextResponse.json({
      purchase_request: prResult.rows[0],
      items: itemsResult.rows
    });

  } catch (error) {
    console.error('Error fetching purchase request details:', error);
    return NextResponse.json({
      error: 'Failed to fetch purchase request',
      message: error.message
    }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/purchase-requests/[prId] - Cancel PR
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Admin can delete PRs
  if (session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ 
      error: 'Only Admins can delete Purchase Requests' 
    }, { status: 403 });
  }

  const { id: projectId, prId } = params;

  try {
    await query('BEGIN');

    // Check if PR exists
    const prCheck = await query(`
      SELECT id, status FROM purchase_requests
      WHERE id = $1 AND project_id = $2
    `, [prId, projectId]);

    if (prCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 });
    }

    // Update status to cancelled
    await query(`
      UPDATE purchase_requests
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [prId]);

    // Also mark all items as cancelled
    await query(`
      UPDATE purchase_request_items
      SET status = 'cancelled', updated_at = NOW()
      WHERE purchase_request_id = $1
    `, [prId]);

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Purchase request cancelled successfully'
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error deleting purchase request:', error);
    return NextResponse.json({
      error: 'Failed to delete purchase request',
      message: error.message
    }, { status: 500 });
  }
}
