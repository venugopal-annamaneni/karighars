import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';
import { calculateItemPricing, calculatePRTotals } from '@/lib/pricing-utils';

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
  const mode = body.mode || 'full_unit'; // 'full_unit', 'component', or 'direct'

  try {
    await query('BEGIN');

    // 1. Fetch GST percentage from active project_base_rates
    const baseRateResult = await query(`
      SELECT gst_percentage FROM project_base_rates 
      WHERE project_id = $1 AND active = true
      LIMIT 1
    `, [projectId]);
    
    const gstPercentage = baseRateResult.rows[0]?.gst_percentage || 0;

    // 2. Verify PR exists and is in draft state
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

    // 3. Add each item based on mode
    let itemsAdded = 0;
    const addedItems = []; // Track added items for totals calculation
    
    if (mode === 'direct') {
      // Direct mode: Add items without estimation links
      for (const item of body.items) {
        // Calculate pricing
        const pricing = calculateItemPricing(
          item.quantity,
          item.unit_price,
          gstPercentage
        );
        
        // Get current version
        const versionResult = await query(`
          SELECT COALESCE(MAX(version), 0) as current_version
          FROM purchase_request_items
          WHERE purchase_request_id = $1
        `, [prId]);
        const currentVersion = versionResult.rows[0].current_version || 1;
        
        await query(`
          INSERT INTO purchase_request_items (
            purchase_request_id, 
            purchase_request_item_name,
            category,
            room_name,
            quantity,
            width,
            height,
            unit,
            unit_price,
            subtotal,
            gst_percentage,
            gst_amount,
            amount_before_gst,
            item_total,
            is_direct_purchase,
            version,
            lifecycle_status,
            status,
            created_at,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, 'pending', 'draft', NOW(), $16)
        `, [
          prId,
          item.name,
          item.category,
          item.room_name || null,
          item.quantity,
          item.width || null,
          item.height || null,
          item.unit,
          item.unit_price || null,
          pricing.subtotal,
          pricing.gst_percentage,
          pricing.gst_amount,
          pricing.amount_before_gst,
          pricing.item_total,
          currentVersion,
          session.user.id
        ]);
        addedItems.push(pricing);
        itemsAdded++;
      }
    } else {
      // Full unit / Component mode: Add items with estimation links
      // Get current version first
      const versionResult = await query(`
        SELECT COALESCE(MAX(version), 0) as current_version
        FROM purchase_request_items
        WHERE purchase_request_id = $1
      `, [prId]);
      const currentVersion = versionResult.rows[0].current_version || 1;
      
      for (const item of body.items) {
        // Calculate pricing
        const pricing = calculateItemPricing(
          item.quantity,
          item.unit_price,
          gstPercentage
        );
        
        // Insert PR item
        const prItemResult = await query(`
          INSERT INTO purchase_request_items (
            purchase_request_id, 
            purchase_request_item_name, 
            quantity,
            width,
            height,
            unit,
            unit_price,
            subtotal,
            gst_percentage,
            gst_amount,
            amount_before_gst,
            item_total,
            is_direct_purchase,
            version,
            lifecycle_status,
            status,
            created_at,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13, 'pending', 'draft', NOW(), $14)
          RETURNING id, stable_item_id
        `, [
          prId,
          item.name,
          item.quantity,
          item.width || null,
          item.height || null,
          item.unit,
          item.unit_price || null,
          pricing.subtotal,
          pricing.gst_percentage,
          pricing.gst_amount,
          pricing.amount_before_gst,
          pricing.item_total,
          currentVersion,
          session.user.id
        ]);

        const prItemId = prItemResult.rows[0].id;
        const stableItemId = prItemResult.rows[0].stable_item_id;
        addedItems.push(pricing);

        // Insert estimation links
        for (const link of item.links) {
          await query(`
            INSERT INTO purchase_request_estimation_links (
              estimation_item_id,
              purchase_request_item_id,
              stable_item_id,
              version,
              linked_qty,
              unit_purchase_request_item_weightage,
              notes,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            link.estimation_item_id,
            prItemId,
            stableItemId,
            currentVersion,
            link.linked_qty,
            link.weightage,
            link.notes || null
          ]);
        }

        itemsAdded++;
      }
    }

    // 4. Recalculate PR totals from ALL items (existing + newly added)
    const allItemsResult = await query(`
      SELECT subtotal, gst_amount, item_total
      FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);
    
    const prTotals = calculatePRTotals(allItemsResult.rows);
    
    // 5. Update PR with new totals and timestamp
    await query(`
      UPDATE purchase_requests
      SET items_value = $1, gst_amount = $2, final_value = $3, updated_at = NOW()
      WHERE id = $4
    `, [prTotals.items_value, prTotals.gst_amount, prTotals.final_value, prId]);

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
