import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PURCHASE_REQUEST_STATUS, ESTIMATION_ITEM_STATUS, USER_ROLE } from '@/app/constants';

// GET /api/projects/[id]/purchase-requests/[prId] - Get PR details
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
        u.name as created_by_name,
        a.name as approved_by_name
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN users a ON pr.approved_by = a.id
      WHERE pr.id = $1 AND pr.project_id = $2
    `, [prId, projectId]);

    if (prResult.rows.length === 0) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 });
    }

    // Get PR items
    const itemsResult = await query(`
      SELECT 
        pri.*,
        ei.status as current_estimation_status
      FROM purchase_request_items pri
      LEFT JOIN estimation_items ei ON pri.estimation_item_id = ei.id
      WHERE pri.purchase_request_id = $1
      ORDER BY pri.category, pri.room_name, pri.item_name
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

// DELETE /api/projects/[id]/purchase-requests/[prId] - Cancel/Delete PR
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

    // Get PR details
    const prCheck = await query(`
      SELECT id, status FROM purchase_requests
      WHERE id = $1 AND project_id = $2
    `, [prId, projectId]);

    if (prCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 });
    }

    // Get all estimation_item_ids linked to this PR
    const itemsResult = await query(`
      SELECT estimation_item_id FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);

    const estimationItemIds = itemsResult.rows.map(row => row.estimation_item_id);

    // Update status to Cancelled
    await query(`
      UPDATE purchase_requests
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [PURCHASE_REQUEST_STATUS.CANCELLED, prId]);

    // Revert estimation items status to Queued
    if (estimationItemIds.length > 0) {
      await query(`
        UPDATE estimation_items
        SET status = $1, updated_at = NOW()
        WHERE id = ANY($2::int[])
      `, [ESTIMATION_ITEM_STATUS.QUEUED, estimationItemIds]);
    }

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Purchase request cancelled and items reverted to Queued status',
      reverted_items_count: estimationItemIds.length
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

// PUT /api/projects/[id]/purchase-requests/[prId] - Update PR (Draft only)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== USER_ROLE.ESTIMATOR && session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ 
      error: 'Only Estimators and Admins can update Purchase Requests' 
    }, { status: 403 });
  }

  const { id: projectId, prId } = params;
  const body = await request.json();

  try {
    await query('BEGIN');

    // Check if PR exists and is in Draft status
    const prCheck = await query(`
      SELECT id, status FROM purchase_requests
      WHERE id = $1 AND project_id = $2
    `, [prId, projectId]);

    if (prCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 });
    }

    if (prCheck.rows[0].status !== PURCHASE_REQUEST_STATUS.DRAFT) {
      await query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Can only edit Purchase Requests in Draft status' 
      }, { status: 400 });
    }

    // Update PR details
    await query(`
      UPDATE purchase_requests
      SET 
        vendor_id = $1,
        expected_delivery_date = $2,
        remarks = $3,
        payment_terms = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [
      body.vendor_id || null,
      body.expected_delivery_date || null,
      body.remarks || null,
      body.payment_terms || null,
      prId
    ]);

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Purchase request updated successfully'
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error updating purchase request:', error);
    return NextResponse.json({
      error: 'Failed to update purchase request',
      message: error.message
    }, { status: 500 });
  }
}
