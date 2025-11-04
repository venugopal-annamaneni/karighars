import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';

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
        pr.created_at,
        pr.notes,
        v.id as vendor_id,
        v.name as vendor_name,
        v.contact_person,
        v.phone as vendor_phone,
        u.name as created_by_name,
        pe.version as estimation_version,
        (SELECT COUNT(*) FROM purchase_request_items WHERE purchase_request_id = pr.id AND active = true) as items_count
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN project_estimations pe ON pr.estimation_id = pe.id
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
    await query('BEGIN');

    // 1. Validate estimation exists
    const estimationCheck = await query(`
      SELECT id FROM project_estimations
      WHERE id = $1 AND project_id = $2 AND is_active = true
    `, [body.estimation_id, projectId]);

    if (estimationCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'Active estimation not found'
      }, { status: 404 });
    }

    // 2. Generate PR number
    const prNumberResult = await query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(pr_number FROM 'PR-${projectId}-(\\d+)') AS INTEGER)), 0) + 1 as next_seq
      FROM purchase_requests
      WHERE project_id = $1
    `, [projectId]);
    const nextSeq = prNumberResult.rows[0].next_seq;
    const prNumber = `PR-${projectId}-${String(nextSeq).padStart(3, '0')}`;

    // 3. Create purchase request
    const status = body.status || 'draft'; // Default to draft
    const prResult = await query(`
      INSERT INTO purchase_requests (
        pr_number, project_id, estimation_id, vendor_id, 
        status, created_by, expected_delivery_date, notes,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, pr_number
    `, [
      prNumber,
      projectId,
      body.estimation_id,
      body.vendor_id || null,
      status,
      session.user.id,
      body.expected_delivery_date || null,
      body.notes || null
    ]);

    const purchaseRequestId = prResult.rows[0].id;

    // 4. Create purchase request items and links
    for (const item of body.items) {
      // Insert PR item
      const prItemResult = await query(`
        INSERT INTO purchase_request_items (
          purchase_request_id, 
          purchase_request_item_name, 
          quantity, 
          unit,
          active,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, true, $5, NOW())
        RETURNING id
      `, [
        purchaseRequestId,
        item.name,
        item.quantity,
        item.unit,
        status
      ]);

      const prItemId = prItemResult.rows[0].id;

      // Insert estimation links
      for (const link of item.links) {
        await query(`
          INSERT INTO purchase_request_estimation_links (
            estimation_item_id,
            purchase_request_item_id,
            linked_qty,
            unit_purchase_request_item_weightage,
            notes,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          link.estimation_item_id,
          prItemId,
          link.linked_qty,
          link.weightage,
          link.notes || null
        ]);
      }
    }

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      purchase_request: {
        id: purchaseRequestId,
        pr_number: prNumber,
        status: status,
        items_count: body.items.length
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
