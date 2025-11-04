import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';

// PUT /api/projects/[id]/purchase-requests/[prId]/add-items - Add items to existing draft PR
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is Estimator or Admin
  if (session.user.role !== USER_ROLE.ESTIMATOR && session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ 
      error: 'Only Estimators and Admins can add items to Purchase Requests' 
    }, { status: 403 });
  }

  const { id: projectId, prId } = params;
  const body = await request.json();

  try {
    await query('BEGIN');

    // 1. Verify PR exists and is in draft state
    const prCheck = await query(`
      SELECT id, status, vendor_id 
      FROM purchase_requests
      WHERE id = $1 AND project_id = $2
    `, [prId, projectId]);

    if (prCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'Purchase request not found'
      }, { status: 404 });
    }

    const pr = prCheck.rows[0];
    if (pr.status !== 'draft') {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'Can only add items to draft purchase requests'
      }, { status: 400 });
    }

    // 2. Add each item and its links
    let itemsAdded = 0;
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
        ) VALUES ($1, $2, $3, $4, true, 'draft', NOW())
        RETURNING id
      `, [
        prId,
        item.name,
        item.quantity,
        item.unit
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

      itemsAdded++;
    }

    // 3. Update PR updated_at timestamp
    await query(`
      UPDATE purchase_requests
      SET updated_at = NOW()
      WHERE id = $1
    `, [prId]);

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      items_added: itemsAdded,
      message: `${itemsAdded} item(s) added to purchase request`
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error adding items to purchase request:', error);
    return NextResponse.json({
      error: 'Failed to add items to purchase request',
      message: error.message
    }, { status: 500 });
  }
}
