import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';
import { calculateItemPricing, calculatePRTotals } from '@/lib/pricing-utils';

// GET /api/projects/[id]/purchase-requests - List all purchase requests
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // e.g., 'draft'
  const vendorFilter = searchParams.get('vendor_id');

  try {
    let queryStr = `
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
        (SELECT COUNT(*) FROM purchase_request_items WHERE purchase_request_id = pr.id AND deleted_at IS NULL) as items_count
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN project_estimations pe ON pr.estimation_id = pe.id
      WHERE pr.project_id = $1
    `;
    
    const queryParams = [projectId];
    let paramIndex = 2;

    if (statusFilter) {
      queryStr += ` AND pr.status = $${paramIndex}`;
      queryParams.push(statusFilter);
      paramIndex++;
    }

    if (vendorFilter) {
      queryStr += ` AND pr.vendor_id = $${paramIndex}`;
      queryParams.push(vendorFilter);
      paramIndex++;
    }

    queryStr += ` ORDER BY pr.created_at DESC`;

    const result = await query(queryStr, queryParams);

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

    // 2. Validate estimation exists (skip for direct mode)
    if (mode !== 'direct') {
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
    }

    // 3. Generate PR number
    const prNumberResult = await query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(pr_number FROM 'PR-${projectId}-(\\d+)') AS INTEGER)), 0) + 1 as next_seq
      FROM purchase_requests
      WHERE project_id = $1
    `, [projectId]);
    const nextSeq = prNumberResult.rows[0].next_seq;
    const prNumber = `PR-${projectId}-${String(nextSeq).padStart(3, '0')}`;

    // 4. Create purchase request (will update totals after items are created)
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
      mode === 'direct' ? null : body.estimation_id, // NULL for direct mode
      body.vendor_id || null,
      status,
      session.user.id,
      body.expected_delivery_date || null,
      body.notes || null
    ]);

    const purchaseRequestId = prResult.rows[0].id;

    // 5. Create purchase request items and links
    const createdItems = []; // Track items for PR totals calculation
    
    if (mode === 'direct') {
      // Direct mode: Create items without estimation links
      for (const item of body.items) {
        // Calculate pricing
        const pricing = calculateItemPricing(
          item.quantity,
          item.unit_price,
          gstPercentage
        );
        
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 1, 'pending', $15, NOW(), $16)
        `, [
          purchaseRequestId,
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
          status,
          session.user.id
        ]);
        
        createdItems.push(pricing);
      }
    } else {
      // Full unit / Component mode: Create items with estimation links
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, 1, 'pending', $13, NOW(), $14)
          RETURNING id, stable_item_id
        `, [
          purchaseRequestId,
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
          status,
          session.user.id
        ]);

        const prItemId = prItemResult.rows[0].id;
        const stableItemId = prItemResult.rows[0].stable_item_id;
        createdItems.push(pricing);

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
            1, // Initial version
            link.linked_qty,
            link.weightage,
            link.notes || null
          ]);
        }
      }
    }

    // 6. Calculate and update PR totals
    const prTotals = calculatePRTotals(createdItems);
    await query(`
      UPDATE purchase_requests
      SET items_value = $1, gst_amount = $2, final_value = $3
      WHERE id = $4
    `, [prTotals.items_value, prTotals.gst_amount, prTotals.final_value, purchaseRequestId]);

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
