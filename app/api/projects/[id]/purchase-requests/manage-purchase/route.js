import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';
import { validatePRQuantities } from '@/lib/pr-validation-utils';
import { archivePRVersion, createNewPR, updatePRTotals } from '@/lib/pr-versioning-utils';
import { calculateItemPricing } from '@/lib/pricing-utils';

// GET /api/projects/[id]/purchase-requests/manage-purchase
// Load estimation items with existing draft PR items merged
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = params;

  try {
    // Step 1: Get active estimation for this project
    const estimationResult = await query(`
      SELECT id, final_value
      FROM project_estimations
      WHERE project_id = $1 AND is_active = true
      LIMIT 1
    `, [projectId]);

    if (estimationResult.rows.length === 0) {
      return NextResponse.json({
        error: 'No active estimation found for this project'
      }, { status: 404 });
    }

    const estimationId = estimationResult.rows[0].id;

    // Step 2: Get all estimation items
    const estimationItems = await query(`
      SELECT 
        ei.id,
        ei.stable_item_id as stable_estimation_item_id,
        ei.category,
        ei.room_name,
        ei.item_name,
        ei.unit,
        ei.width,
        ei.height,
        ei.quantity as estimation_qty,
        ei.rate,
        ei.item_total as estimation_item_total
      FROM estimation_items ei
      WHERE ei.estimation_id = $1
      ORDER BY ei.category, ei.room_name, ei.item_name
    `, [estimationId]);

    // Step 3: Get all active draft PRs with their items and links
    const draftPRItems = await query(`
      SELECT 
        pr.id as pr_id,
        pr.pr_number,
        pr.vendor_id,
        v.name as vendor_name,
        pri.id as item_id,
        pri.stable_item_id,
        pri.purchase_request_item_name,
        pri.category,
        pri.room_name,
        pri.unit,
        pri.width,
        pri.height,
        pri.quantity,
        pri.unit_price,
        pri.subtotal,
        pri.gst_percentage,
        pri.gst_amount,
        pri.item_total,
        pri.status,
        pri.is_direct_purchase,
        prel.stable_estimation_item_id,
        prel.linked_qty,
        prel.unit_purchase_request_item_weightage as weightage
      FROM purchase_requests pr
      JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id
      LEFT JOIN purchase_request_estimation_links prel ON pri.stable_item_id = prel.stable_item_id
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      WHERE pr.project_id = $1 
        AND pr.active = true 
        AND pr.status = 'draft'
        AND pri.active = true
      ORDER BY pr.vendor_id, pri.id
    `, [projectId]);

    // Step 4: Get all vendors for dropdown
    const vendorsResult = await query(`
      SELECT id, name, contact_person, phone, email
      FROM vendors
      ORDER BY name
    `);

    // Step 5: Merge estimation items with draft PR items
    const mergedItems = estimationItems.rows.map(estItem => {
      // Find all PR items linked to this estimation item
      const linkedItems = draftPRItems.rows.filter(prItem => 
        prItem.stable_estimation_item_id === estItem.stable_estimation_item_id
      );

      if (linkedItems.length === 0) {
        // Not purchased yet
        return {
          ...estItem,
          fulfillmentMode: null,
          prItems: []
        };
      }

      // Check if it's full item or components
      const hasComponents = linkedItems.some(item => item.weightage < 1.0);
      
      if (hasComponents) {
        // Component fulfillment
        return {
          ...estItem,
          fulfillmentMode: 'component',
          prItems: linkedItems.map(item => ({
            pr_id: item.pr_id,
            pr_number: item.pr_number,
            item_id: item.item_id,
            stable_item_id: item.stable_item_id,
            component_name: item.purchase_request_item_name,
            vendor_id: item.vendor_id,
            vendor_name: item.vendor_name,
            unit: item.unit,
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            weightage: parseFloat(item.weightage),
            unit_price: parseFloat(item.unit_price),
            subtotal: parseFloat(item.subtotal),
            gst_percentage: parseFloat(item.gst_percentage),
            item_total: parseFloat(item.item_total),
            status: item.status
          }))
        };
      } else {
        // Full item fulfillment (should be only 1 item)
        const prItem = linkedItems[0];
        return {
          ...estItem,
          fulfillmentMode: 'full',
          prItems: [{
            pr_id: prItem.pr_id,
            pr_number: prItem.pr_number,
            item_id: prItem.item_id,
            stable_item_id: prItem.stable_item_id,
            vendor_id: prItem.vendor_id,
            vendor_name: prItem.vendor_name,
            unit: prItem.unit,
            width: prItem.width,
            height: prItem.height,
            quantity: parseFloat(prItem.quantity),
            unit_price: parseFloat(prItem.unit_price),
            subtotal: parseFloat(prItem.subtotal),
            gst_percentage: parseFloat(prItem.gst_percentage),
            item_total: parseFloat(prItem.item_total),
            status: prItem.status
          }]
        };
      }
    });

    // Step 6: Get direct purchase items (not linked to estimation)
    const directPurchaseItems = draftPRItems.rows
      .filter(item => item.is_direct_purchase)
      .map(item => ({
        pr_id: item.pr_id,
        pr_number: item.pr_number,
        item_id: item.item_id,
        stable_item_id: item.stable_item_id,
        name: item.purchase_request_item_name,
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        unit: item.unit,
        width: item.width,
        height: item.height,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        subtotal: parseFloat(item.subtotal),
        gst_percentage: parseFloat(item.gst_percentage),
        gst_amount: parseFloat(item.gst_amount),
        item_total: parseFloat(item.item_total)
      }));

    return NextResponse.json({
      success: true,
      estimation_id: estimationId,
      estimation_items: mergedItems,
      additional_purchases: directPurchaseItems,
      vendors: vendorsResult.rows
    });

  } catch (error) {
    console.error('Error loading manage purchase data:', error);
    return NextResponse.json({
      error: 'Failed to load data',
      message: error.message
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/purchase-requests/manage-purchase
// Save PR items grouped by vendor
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is Estimator or Admin
  if (session.user.role !== USER_ROLE.ESTIMATOR && session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ 
      error: 'Only Estimators and Admins can create/edit Purchase Requests' 
    }, { status: 403 });
  }

  const { id: projectId } = params;
  const body = await request.json();

  try {
    await query('BEGIN');

    const { estimation_id, items, additional_purchases } = body;

    // Step 1: Get GST percentage from project base rates
    const baseRateResult = await query(`
      SELECT gst_percentage FROM project_base_rates 
      WHERE project_id = $1 AND active = true
      LIMIT 1
    `, [projectId]);
    
    const gstPercentage = baseRateResult.rows[0]?.gst_percentage || 18;

    // Step 2: Flatten all items and group by vendor
    const vendorGroups = {};

    // Process estimation items
    items.forEach(item => {
      if (!item.fulfillmentMode || item.fulfillmentMode === 'none') {
        return; // Skip items without fulfillment mode
      }

      if (item.fulfillmentMode === 'full') {
        // Full item - single vendor
        const vendorId = item.vendor_id;
        if (!vendorGroups[vendorId]) {
          vendorGroups[vendorId] = [];
        }

        vendorGroups[vendorId].push({
          type: 'full',
          stable_estimation_item_id: item.stable_estimation_item_id,
          name: item.item_name,
          category: item.category,
          room_name: item.room_name,
          unit: item.unit,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unit_price: item.unit_price,
          gst_percentage: item.gst_percentage || gstPercentage,
          weightage: 1.0,
          linked_qty: item.quantity
        });
      } else if (item.fulfillmentMode === 'component') {
        // Components - multiple vendors
        item.components.forEach(comp => {
          const vendorId = comp.vendor_id;
          if (!vendorGroups[vendorId]) {
            vendorGroups[vendorId] = [];
          }

          vendorGroups[vendorId].push({
            type: 'component',
            stable_estimation_item_id: item.stable_estimation_item_id,
            name: comp.name,
            category: item.category,
            room_name: item.room_name,
            unit: comp.unit,
            width: comp.width,
            height: comp.height,
            quantity: comp.quantity,
            unit_price: comp.unit_price,
            gst_percentage: comp.gst_percentage || gstPercentage,
            weightage: comp.weightage,
            linked_qty: comp.quantity
          });
        });
      }
    });

    // Process additional purchases (direct)
    if (additional_purchases && additional_purchases.length > 0) {
      additional_purchases.forEach(item => {
        const vendorId = item.vendor_id;
        if (!vendorGroups[vendorId]) {
          vendorGroups[vendorId] = [];
        }

        vendorGroups[vendorId].push({
          type: 'direct',
          name: item.name,
          unit: item.unit,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unit_price: item.unit_price,
          gst_percentage: item.gst_percentage || gstPercentage,
          is_direct_purchase: true
        });
      });
    }

    // Step 3: Validate quantities for estimation items
    const itemsForValidation = [];
    Object.values(vendorGroups).forEach(vendorItems => {
      vendorItems.forEach(item => {
        if (item.stable_estimation_item_id) {
          itemsForValidation.push({
            name: item.name,
            links: [{
              stable_estimation_item_id: item.stable_estimation_item_id,
              linked_qty: item.linked_qty,
              weightage: item.weightage
            }]
          });
        }
      });
    });

    if (itemsForValidation.length > 0) {
      const validationErrors = await validatePRQuantities(
        projectId,
        itemsForValidation,
        estimation_id,
        null // Don't exclude any PR (we're validating all new allocations)
      );

      if (validationErrors.length > 0) {
        await query('ROLLBACK');
        return NextResponse.json({
          error: 'Quantity validation failed',
          details: validationErrors
        }, { status: 400 });
      }
    }

    // Step 4: For each vendor, create or update PR
    const createdPRs = [];

    for (const [vendorId, vendorItems] of Object.entries(vendorGroups)) {
      // Check if vendor has existing draft PR
      const existingPRResult = await query(`
        SELECT id, pr_number
        FROM purchase_requests
        WHERE project_id = $1 AND vendor_id = $2 AND active = true AND status = 'draft'
        LIMIT 1
      `, [projectId, vendorId]);

      let prId, prNumber;

      if (existingPRResult.rows.length > 0) {
        // Archive existing PR version
        const oldPRId = existingPRResult.rows[0].id;
        await archivePRVersion(oldPRId);

        // Create new PR version
        const newPR = await createNewPR({
          project_id: projectId,
          vendor_id: vendorId,
          estimation_id: estimation_id,
          status: 'draft',
          created_by: session.user.id
        });
        prId = newPR.id;
        prNumber = newPR.pr_number;
      } else {
        // Create new PR
        const newPR = await createNewPR({
          project_id: projectId,
          vendor_id: vendorId,
          estimation_id: estimation_id,
          status: 'draft',
          created_by: session.user.id
        });
        prId = newPR.id;
        prNumber = newPR.pr_number;
      }

      // Insert items for this PR
      for (const item of vendorItems) {
        const pricing = calculateItemPricing(
          item.quantity,
          item.unit_price,
          item.gst_percentage
        );

        // Insert PR item
        const prItemResult = await query(`
          INSERT INTO purchase_request_items (
            purchase_request_id,
            purchase_request_item_name,
            category,
            room_name,
            unit,
            width,
            height,
            quantity,
            unit_price,
            subtotal,
            gst_percentage,
            gst_amount,
            amount_before_gst,
            item_total,
            is_direct_purchase,
            status,
            lifecycle_status,
            created_at,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', 'pending', NOW(), $16)
          RETURNING id, stable_item_id
        `, [
          prId,
          item.name,
          item.category || null,
          item.room_name || null,
          item.unit,
          item.width || null,
          item.height || null,
          item.quantity,
          item.unit_price,
          pricing.subtotal,
          pricing.gst_percentage,
          pricing.gst_amount,
          pricing.amount_before_gst,
          pricing.item_total,
          item.is_direct_purchase || false,
          session.user.id
        ]);

        const stableItemId = prItemResult.rows[0].stable_item_id;

        // Insert estimation link if not direct purchase
        if (item.stable_estimation_item_id) {
          await query(`
            INSERT INTO purchase_request_estimation_links (
              stable_estimation_item_id,
              stable_item_id,
              linked_qty,
              unit_purchase_request_item_weightage,
              created_at,
              created_by
            ) VALUES ($1, $2, $3, $4, NOW(), $5)
          `, [
            item.stable_estimation_item_id,
            stableItemId,
            item.linked_qty,
            item.weightage,
            session.user.id
          ]);
        }
      }

      // Update PR totals
      await updatePRTotals(prId);

      createdPRs.push({ id: prId, pr_number: prNumber, vendor_id: vendorId });
    }

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `${createdPRs.length} PR(s) created/updated`,
      prs: createdPRs
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error saving purchase requests:', error);
    return NextResponse.json({
      error: 'Failed to save purchase requests',
      message: error.message
    }, { status: 500 });
  }
}
