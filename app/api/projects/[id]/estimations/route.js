import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { ESTIMATION_STATUS, PAYMENT_STATUS, ESTIMATION_ITEM_STATUS } from '@/app/constants';

// POST - Create new estimation (only if none exists for project)
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Build category_breakdown JSONB from items
  const categoryBreakdown = body.category_breakdown || {};

  // Aggregate totals
  const itemsValue = parseFloat(body.items_value) || 0;
  const itemsDiscount = parseFloat(body.items_discount) || 0;
  const kgCharges = parseFloat(body.kg_charges) || 0;
  const kgDiscount = parseFloat(body.kg_charges_discount) || 0;
  const discount = itemsDiscount + kgDiscount;
  const gstAmount = parseFloat(body.gst_amount) || 0;
  const finalValue = parseFloat(body.final_value) || 0;

  let hasOverpayment = false;
  let overpaymentAmount = 0;
  
  // Get total approved payments
  const paymentsRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as total_collected
      FROM customer_payments
      WHERE project_id = $1 AND status = $2
    `, [body.project_id, PAYMENT_STATUS.APPROVED]);

  const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);

  if (totalCollected > finalValue) {
    hasOverpayment = true;
    overpaymentAmount = totalCollected - finalValue;
  }

  try {
    await query("BEGIN");
    
    // 1. Check if estimation already exists for this project
    const existingResult = await query(`
      SELECT id FROM project_estimations
      WHERE project_id = $1
    `, [body.project_id]);
    
    if (existingResult.rows.length > 0) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: 'Estimation already exists for this project. Use PUT to update.',
        estimation_id: existingResult.rows[0].id
      }, { status: 400 });
    }
    
    // 2. Create new estimation (first time only)
    const result = await query(
      `INSERT INTO project_estimations (
      project_id, created_by,
      category_breakdown,
      items_value, kg_charges, items_discount, kg_discount, discount, gst_amount, 
      final_value,
      has_overpayment, overpayment_amount,
      remarks
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        body.project_id, session.user.id,
        JSON.stringify(categoryBreakdown),
        itemsValue, kgCharges, itemsDiscount, kgDiscount, discount, gstAmount,
        finalValue,
        hasOverpayment, overpaymentAmount,
        body.remarks,
      ]
    );

    console.log(`Created new estimation ${result.rows[0].id} for project ${body.project_id}`);

    // 3. Add estimation items
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        // Calculate quantity based on unit type
        let finalQuantity = item.quantity;
        if (item.unit === 'sqft' && item.width && item.height) {
          finalQuantity = parseFloat(item.width) * parseFloat(item.height);
        }
        
        // For new estimation, all items are new (no stable_item_id)
        const stableItemId = null; // DB will generate UUID
        
        await query(
          `INSERT INTO estimation_items (
          estimation_id, stable_item_id, category, room_name, vendor_type, item_name, 
          unit, width, height, quantity, unit_price,
          subtotal, karighar_charges_percentage, karighar_charges_amount, item_discount_percentage, item_discount_amount, 
          discount_kg_charges_percentage, discount_kg_charges_amount, gst_percentage, gst_amount, amount_before_gst, item_total,
          status, created_at, created_by, updated_at, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), $24, NOW(), $24)`,
          [
            result.rows[0].id, 
            stableItemId,
            item.category, item.room_name, item.vendor_type, item.item_name,
            item.unit, parseFloat(item.width) || null, parseFloat(item.height) || null, parseFloat(finalQuantity), parseFloat(item.unit_price),
            parseFloat(item.subtotal), parseFloat(item.karighar_charges_percentage), parseFloat(item.karighar_charges_amount), parseFloat(item.item_discount_percentage), parseFloat(item.item_discount_amount),
            parseFloat(item.discount_kg_charges_percentage), parseFloat(item.discount_kg_charges_amount), parseFloat(item.gst_percentage), parseFloat(item.gst_amount), parseFloat(item.amount_before_gst), parseFloat(item.item_total),
            ESTIMATION_ITEM_STATUS.QUEUED,
            session.user.id
          ]
        );
      }
    }
    
    // Commit transaction
    await query("COMMIT");
    console.log(`Transaction committed for estimation ${result.rows[0].id}`);
    
    // If overpayment detected, return warning
    if (hasOverpayment) {
      return NextResponse.json({
        estimation: result.rows[0],
        warning: 'overpayment_detected',
        overpayment: {
          amount: overpaymentAmount,
          status: 'pending_approval',
          message: 'Admin must approve this estimation to create credit note'
        }
      });
    }
    
    return NextResponse.json({ estimation: result.rows[0] });

  } catch (error) {
    await query("ROLLBACK");
    console.error('API Error - Rolling back transaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update existing estimation
export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, estimation_id } = body;

  // Build category_breakdown JSONB from items
  const categoryBreakdown = body.category_breakdown || {};

  // Aggregate totals
  const itemsValue = parseFloat(body.items_value) || 0;
  const itemsDiscount = parseFloat(body.items_discount) || 0;
  const kgCharges = parseFloat(body.kg_charges) || 0;
  const kgDiscount = parseFloat(body.kg_charges_discount) || 0;
  const discount = itemsDiscount + kgDiscount;
  const gstAmount = parseFloat(body.gst_amount) || 0;
  const finalValue = parseFloat(body.final_value) || 0;

  let hasOverpayment = false;
  let overpaymentAmount = 0;
  
  // Get total approved payments
  const paymentsRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as total_collected
      FROM customer_payments
      WHERE project_id = $1 AND status = $2
    `, [project_id, PAYMENT_STATUS.APPROVED]);

  const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);

  if (totalCollected > finalValue) {
    hasOverpayment = true;
    overpaymentAmount = totalCollected - finalValue;
  }

  try {
    await query("BEGIN");
    
    // 1. Get existing estimation
    const estimationResult = await query(`
      SELECT id FROM project_estimations
      WHERE project_id = $1
    `, [project_id]);
    
    if (estimationResult.rows.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: 'Estimation not found. Use POST to create.'
      }, { status: 404 });
    }
    
    const estimationId = estimationResult.rows[0].id;
    
    // 2. Get current max version from history
    const versionResult = await query(`
      SELECT COALESCE(MAX(version), 0) as max_version
      FROM estimation_items_history
      WHERE estimation_id = $1
    `, [estimationId]);
    
    const nextVersion = versionResult.rows[0].max_version + 1;
    console.log(`Creating version ${nextVersion} for estimation ${estimationId}`);
    
    // 3. Fetch old items (for preserving created_at/created_by)
    const oldItemsResult = await query(`
      SELECT stable_item_id, created_at, created_by
      FROM estimation_items
      WHERE estimation_id = $1
    `, [estimationId]);
    
    let oldItemsMap = new Map();
    oldItemsResult.rows.forEach(item => {
      oldItemsMap.set(item.stable_item_id, {
        created_at: item.created_at,
        created_by: item.created_by
      });
    });
    
    console.log(`Archiving ${oldItemsResult.rows.length} items to history (version ${nextVersion})`);
    
    // 4. Archive current items to history with version
    await query(`
      INSERT INTO estimation_items_history (
        id, stable_item_id, estimation_id,
        category, room_name, vendor_type, item_name,
        unit, width, height, quantity, unit_price,
        subtotal, karighar_charges_percentage, karighar_charges_amount,
        item_discount_percentage, item_discount_amount,
        discount_kg_charges_percentage, discount_kg_charges_amount,
        gst_percentage, gst_amount, amount_before_gst, item_total,
        status, created_at, created_by, updated_at, updated_by,
        version, archived_at, archived_by
      )
      SELECT 
        id, stable_item_id, estimation_id,
        category, room_name, vendor_type, item_name,
        unit, width, height, quantity, unit_price,
        subtotal, karighar_charges_percentage, karighar_charges_amount,
        item_discount_percentage, item_discount_amount,
        discount_kg_charges_percentage, discount_kg_charges_amount,
        gst_percentage, gst_amount, amount_before_gst, item_total,
        status, created_at, created_by, updated_at, updated_by,
        $2, NOW(), $3
      FROM estimation_items
      WHERE estimation_id = $1
    `, [estimationId, nextVersion, session.user.id]);
    
    // 5. Delete current items
    await query(`
      DELETE FROM estimation_items
      WHERE estimation_id = $1
    `, [estimationId]);
    
    console.log(`Items archived and deleted from estimation ${estimationId}`);
    
    // 6. Insert new items
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        // Calculate quantity based on unit type
        let finalQuantity = item.quantity;
        if (item.unit === 'sqft' && item.width && item.height) {
          finalQuantity = parseFloat(item.width) * parseFloat(item.height);
        }
        
        const stableItemId = item.stable_item_id || null;
        
        // Determine creation audit fields
        let createdAt, createdBy;
        
        if (stableItemId && oldItemsMap.has(stableItemId)) {
          // EXISTING ITEM: Preserve original created_at and created_by
          const oldAudit = oldItemsMap.get(stableItemId);
          createdAt = oldAudit.created_at;
          createdBy = oldAudit.created_by;
        } else {
          // NEW ITEM: Set created_at and created_by to current values
          createdAt = null;
          createdBy = session.user.id;
        }
        
        await query(
          `INSERT INTO estimation_items (
          estimation_id, stable_item_id, category, room_name, vendor_type, item_name, 
          unit, width, height, quantity, unit_price,
          subtotal, karighar_charges_percentage, karighar_charges_amount, item_discount_percentage, item_discount_amount, 
          discount_kg_charges_percentage, discount_kg_charges_amount, gst_percentage, gst_amount, amount_before_gst, item_total,
          status, created_at, created_by, updated_at, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, COALESCE($24, NOW()), $25, NOW(), $26)`,
          [
            estimationId, 
            stableItemId,
            item.category, item.room_name, item.vendor_type, item.item_name,
            item.unit, parseFloat(item.width) || null, parseFloat(item.height) || null, parseFloat(finalQuantity), parseFloat(item.unit_price),
            parseFloat(item.subtotal), parseFloat(item.karighar_charges_percentage), parseFloat(item.karighar_charges_amount), parseFloat(item.item_discount_percentage), parseFloat(item.item_discount_amount),
            parseFloat(item.discount_kg_charges_percentage), parseFloat(item.discount_kg_charges_amount), parseFloat(item.gst_percentage), parseFloat(item.gst_amount), parseFloat(item.amount_before_gst), parseFloat(item.item_total),
            ESTIMATION_ITEM_STATUS.QUEUED,
            createdAt,
            createdBy,
            session.user.id
          ]
        );
      }
    }
    
    // 7. Update estimation record with new totals
    await query(`
      UPDATE project_estimations
      SET 
        category_breakdown = $2,
        items_value = $3,
        kg_charges = $4,
        items_discount = $5,
        kg_discount = $6,
        discount = $7,
        gst_amount = $8,
        final_value = $9,
        has_overpayment = $10,
        overpayment_amount = $11,
        remarks = $12,
        updated_at = NOW(),
        updated_by = $13
      WHERE id = $1
    `, [
      estimationId,
      JSON.stringify(categoryBreakdown),
      itemsValue, kgCharges, itemsDiscount, kgDiscount, discount, gstAmount, finalValue,
      hasOverpayment, overpaymentAmount,
      body.remarks,
      session.user.id
    ]);
    
    console.log(`Updated estimation ${estimationId} with new totals`);
    
    // Commit transaction
    await query("COMMIT");
    console.log(`Transaction committed for estimation ${estimationId}, version ${nextVersion}`);
    
    // If overpayment detected, return warning
    if (hasOverpayment) {
      return NextResponse.json({
        success: true,
        message: 'Estimation updated successfully',
        estimation_id: estimationId,
        version: nextVersion,
        warning: 'overpayment_detected',
        overpayment: {
          amount: overpaymentAmount,
          status: 'pending_approval',
          message: 'Admin must approve this estimation to create credit note'
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Estimation updated successfully',
      estimation_id: estimationId,
      version: nextVersion
    });

  } catch (error) {
    await query("ROLLBACK");
    console.error('API Error - Rolling back transaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Fetch estimations (keep existing logic)
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = params;

  try {
    // Fetch estimation for project (now there's only one per project)
    const result = await query(
      `SELECT * FROM project_estimations WHERE project_id = $1`,
      [projectId]
    );

    return NextResponse.json({ estimations: result.rows });
  } catch (error) {
    console.error('Error fetching estimations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
