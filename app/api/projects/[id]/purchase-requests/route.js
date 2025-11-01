import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PURCHASE_REQUEST_STATUS, ESTIMATION_ITEM_STATUS, USER_ROLE } from '@/app/constants';

// GET /api/projects/[id]/purchase-requests - List all purchase requests
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    const result = await query(`
      SELECT 
        pr.id,
        pr.pr_number,
        pr.status,
        pr.expected_delivery_date,
        pr.actual_delivery_date,
        pr.total_amount,
        pr.gst_amount,
        pr.final_amount,
        pr.remarks,
        pr.payment_terms,
        pr.created_at,
        pr.submitted_at,
        pr.approved_at,
        v.id as vendor_id,
        v.name as vendor_name,
        v.contact_person,
        v.phone as vendor_phone,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM purchase_request_items WHERE purchase_request_id = pr.id) as items_count
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE pr.project_id = $1
      ORDER BY pr.created_at DESC
    `, [projectId]);

    return NextResponse.json({
      purchase_requests: result.rows
    });
  } catch (error) {
    console.error('Error fetching purchase requests:', error);
    return NextResponse.json({
      error: 'Failed to fetch purchase requests',
      message: error.message
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/purchase-requests - Create new purchase request
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is Estimator or Admin
  if (session.user.role !== USER_ROLE.ESTIMATOR && session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ 
      error: 'Only Estimators and Admins can create Purchase Requests' 
    }, { status: 403 });
  }

  const projectId = params.id;
  const body = await request.json();

  try {
    // Start transaction
    await query('BEGIN');

    // 1. Validate estimation items
    const itemsCheck = await query(`
      SELECT id, status, category, room_name, item_name, quantity, unit, unit_price, 
             subtotal, gst_percentage, gst_amount, item_total
      FROM estimation_items
      WHERE id = ANY($1::int[])
    `, [body.estimation_item_ids]);

    if (itemsCheck.rows.length !== body.estimation_item_ids.length) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'One or more estimation items not found'
      }, { status: 404 });
    }

    // Check if all items are in Queued status
    const nonQueuedItems = itemsCheck.rows.filter(
      item => item.status !== ESTIMATION_ITEM_STATUS.QUEUED
    );

    if (nonQueuedItems.length > 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: `Items must be in "Queued" status. Found ${nonQueuedItems.length} item(s) with different status.`,
        items: nonQueuedItems.map(i => ({ id: i.id, status: i.status, item_name: i.item_name }))
      }, { status: 400 });
    }

    // 2. Generate PR number
    const prNumberResult = await query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(pr_number FROM 'PR-${projectId}-(\\d+)') AS INTEGER)), 0) + 1 as next_seq
      FROM purchase_requests
      WHERE project_id = $1
    `, [projectId]);
    const nextSeq = prNumberResult.rows[0].next_seq;
    const prNumber = `PR-${projectId}-${String(nextSeq).padStart(3, '0')}`;

    // 3. Calculate totals
    let totalAmount = 0;
    let gstAmount = 0;
    itemsCheck.rows.forEach(item => {
      totalAmount += parseFloat(item.subtotal || 0);
      gstAmount += parseFloat(item.gst_amount || 0);
    });
    const finalAmount = totalAmount + gstAmount;

    // 4. Create purchase request
    const prResult = await query(`
      INSERT INTO purchase_requests (
        pr_number, project_id, vendor_id, status,
        created_by, expected_delivery_date,
        total_amount, gst_amount, final_amount,
        remarks, payment_terms,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, pr_number
    `, [
      prNumber,
      projectId,
      body.vendor_id || null,
      PURCHASE_REQUEST_STATUS.DRAFT,
      session.user.id,
      body.expected_delivery_date || null,
      totalAmount,
      gstAmount,
      finalAmount,
      body.remarks || null,
      body.payment_terms || null
    ]);

    const purchaseRequestId = prResult.rows[0].id;

    // 5. Create purchase request items
    for (const item of itemsCheck.rows) {
      await query(`
        INSERT INTO purchase_request_items (
          purchase_request_id, estimation_item_id,
          category, room_name, item_name,
          quantity, unit, unit_price,
          subtotal, gst_amount, item_total,
          quoted_price, final_price,
          pending_quantity,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      `, [
        purchaseRequestId,
        item.id,
        item.category,
        item.room_name,
        item.item_name,
        item.quantity,
        item.unit,
        item.unit_price,
        item.subtotal,
        item.gst_amount,
        item.item_total,
        item.unit_price, // Default quoted_price to unit_price
        item.unit_price, // Default final_price to unit_price
        item.quantity // All quantity is pending initially
      ]);
    }

    // 6. Update estimation items status to PR Raised
    await query(`
      UPDATE estimation_items
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2::int[])
    `, [ESTIMATION_ITEM_STATUS.PR_RAISED, body.estimation_item_ids]);

    // Commit transaction
    await query('COMMIT');

    return NextResponse.json({
      success: true,
      purchase_request: {
        id: purchaseRequestId,
        pr_number: prNumber,
        status: PURCHASE_REQUEST_STATUS.DRAFT,
        items_count: body.estimation_item_ids.length,
        total_amount: finalAmount
      }
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error creating purchase request:', error);
    return NextResponse.json({
      error: 'Failed to create purchase request',
      message: error.message
    }, { status: 500 });
  }
}
