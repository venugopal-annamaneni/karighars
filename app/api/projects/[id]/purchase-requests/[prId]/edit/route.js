import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';
import { createNewPRVersion, canEditItem } from '@/lib/versioning-utils';

// PUT /api/projects/[id]/purchase-requests/[prId]/edit - Edit PR items (creates new version)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is Estimator or Admin
  if (session.user.role !== USER_ROLE.ESTIMATOR && session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ 
      error: 'Only Estimators and Admins can edit Purchase Requests' 
    }, { status: 403 });
  }

  const { id: projectId, prId } = params;
  const body = await request.json();

  try {
    await query('BEGIN');

    // 1. Verify PR exists
    const prCheck = await query(`
      SELECT id FROM purchase_requests
      WHERE id = $1 AND project_id = $2
    `, [prId, projectId]);

    if (prCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'Purchase request not found'
      }, { status: 404 });
    }

    // 2. Validate that all items being edited are in 'pending' status
    const itemsToEdit = body.items || [];
    
    if (itemsToEdit.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'No items provided for editing'
      }, { status: 400 });
    }

    // Get stable_item_ids from request
    const stableItemIds = itemsToEdit.map(item => item.stable_item_id).filter(Boolean);
    
    if (stableItemIds.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: 'Invalid items: missing stable_item_id'
      }, { status: 400 });
    }

    // Check lifecycle status for all items
    const statusCheck = await query(`
      SELECT stable_item_id, lifecycle_status
      FROM purchase_request_items
      WHERE stable_item_id = ANY($1::uuid[])
      AND purchase_request_id = $2
    `, [stableItemIds, prId]);

    const nonEditableItems = statusCheck.rows.filter(
      item => !canEditItem(item.lifecycle_status)
    );

    if (nonEditableItems.length > 0) {
      await query('ROLLBACK');
      return NextResponse.json({
        error: `Cannot edit items with lifecycle status other than 'pending'`,
        non_editable_items: nonEditableItems.map(i => ({
          stable_item_id: i.stable_item_id,
          lifecycle_status: i.lifecycle_status
        }))
      }, { status: 400 });
    }

    // 3. Create new version with updated items
    const newVersion = await createNewPRVersion(
      prId,
      itemsToEdit,
      session.user.id,
      body.change_summary || `Edited ${itemsToEdit.length} item(s)`
    );

    // 4. Update PR header if provided
    if (body.vendor_id || body.expected_delivery_date || body.notes) {
      await query(`
        UPDATE purchase_requests
        SET 
          vendor_id = COALESCE($1, vendor_id),
          expected_delivery_date = COALESCE($2, expected_delivery_date),
          notes = COALESCE($3, notes),
          updated_at = NOW()
        WHERE id = $4
      `, [
        body.vendor_id || null,
        body.expected_delivery_date || null,
        body.notes || null,
        prId
      ]);
    }

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Purchase request updated successfully`,
      version: newVersion
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error editing purchase request:', error);
    return NextResponse.json({
      error: 'Failed to edit purchase request',
      message: error.message
    }, { status: 500 });
  }
}

// Note: DELETE endpoint removed. Deletions are now handled by simply not including
// the item in the PUT request. The versioning system will only re-insert items
// that are present in the payload, effectively deleting items that are omitted.
