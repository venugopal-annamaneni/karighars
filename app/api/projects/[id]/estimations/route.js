import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { ESTIMATION_STATUS, PAYMENT_STATUS, ESTIMATION_ITEM_STATUS } from '@/app/constants';

// --- Helper: compute totals cleanly ---
function computeTotals(body) {
  const n = (v) => parseFloat(v) || 0;
  const itemsValue = n(body.items_value);
  const itemsDiscount = n(body.items_discount);
  const kgCharges = n(body.kg_charges);
  const kgDiscount = n(body.kg_charges_discount);
  const discount = itemsDiscount + kgDiscount;
  const gstAmount = n(body.gst_amount);
  const finalValue = n(body.final_value);
  return { itemsValue, itemsDiscount, kgCharges, kgDiscount, discount, gstAmount, finalValue };
}

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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { project_id } = body;
  const { itemsValue, itemsDiscount, kgCharges, kgDiscount, discount, gstAmount, finalValue } = computeTotals(body);
  const categoryBreakdown = body.category_breakdown || {};

  try {
    await query('BEGIN');

    // 1️⃣ Combined metadata query (estimation id, max version, total collected)
    const meta = await query(`
      SELECT 
        pe.id AS estimation_id,
        (SELECT COALESCE(MAX(version), 0) FROM estimation_items_history WHERE estimation_id = pe.id) AS max_version,
        (SELECT COALESCE(SUM(amount), 0) FROM customer_payments WHERE project_id = $1 AND status = $2) AS total_collected
      FROM project_estimations pe
      WHERE pe.project_id = $1
    `, [project_id, PAYMENT_STATUS.APPROVED]);

    if (meta.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Estimation not found. Use POST to create.' }, { status: 404 });
    }

    const { estimation_id, max_version, total_collected } = meta.rows[0];
    const nextVersion = Number(max_version) + 1;
    const totalCollected = parseFloat(total_collected || 0);
    const hasOverpayment = totalCollected > finalValue;
    const overpaymentAmount = hasOverpayment ? totalCollected - finalValue : 0;

    // 2️⃣ Fetch old items to preserve created_at/created_by (needed before we delete them)
    const oldItemsResult = await query(`
      SELECT stable_item_id, created_at, created_by
      FROM estimation_items
      WHERE estimation_id = $1
    `, [estimation_id]);

    const oldItemsMap = new Map();
    oldItemsResult.rows.forEach(row => {
      // stable_item_id may be null for legacy rows; map only defined stable ids
      if (row.stable_item_id) {
        oldItemsMap.set(String(row.stable_item_id), {
          created_at: row.created_at,
          created_by: row.created_by
        });
      }
    });

    // 3️⃣ Archive + delete existing items in one go
    await query(`
      WITH deleted AS (
        DELETE FROM estimation_items
        WHERE estimation_id = $1
        RETURNING *
      )
      INSERT INTO estimation_items_history (
        id, stable_item_id, estimation_id, category, room_name, vendor_type, item_name,
        unit, width, height, quantity, unit_price, subtotal,
        karighar_charges_percentage, karighar_charges_amount,
        item_discount_percentage, item_discount_amount,
        discount_kg_charges_percentage, discount_kg_charges_amount,
        gst_percentage, gst_amount, amount_before_gst, item_total,
        status, created_at, created_by, updated_at, updated_by,
        version, archived_at, archived_by
      )
      SELECT 
        id, stable_item_id, estimation_id, category, room_name, vendor_type, item_name,
        unit, width, height, quantity, unit_price, subtotal,
        karighar_charges_percentage, karighar_charges_amount,
        item_discount_percentage, item_discount_amount,
        discount_kg_charges_percentage, discount_kg_charges_amount,
        gst_percentage, gst_amount, amount_before_gst, item_total,
        status, created_at, created_by, updated_at, updated_by,
        $2 AS version, NOW() AS archived_at, $3 AS archived_by
      FROM deleted;
    `, [estimation_id, nextVersion, session.user.id]);

    // 4️⃣ Insert new items in bulk (but preserve created_at/created_by where stable_id existed)
    if (body.items && body.items.length > 0) {
      const insertCols = `
        estimation_id, stable_item_id, category, room_name, vendor_type, item_name,
        unit, width, height, quantity, unit_price,
        subtotal, karighar_charges_percentage, karighar_charges_amount,
        item_discount_percentage, item_discount_amount,
        discount_kg_charges_percentage, discount_kg_charges_amount,
        gst_percentage, gst_amount, amount_before_gst, item_total,
        status, created_at, created_by, updated_at, updated_by
      `;

      const placeholders = [];
      const values = [];
      let i = 1;

      for (const item of body.items) {
        const finalQty =
          item.unit === 'sqft' && item.width && item.height
            ? parseFloat(item.width) * parseFloat(item.height)
            : parseFloat(item.quantity) || 0;

        // Preserve stable id if provided, or null (DB gen via COALESCE)
        const stableId = item.stable_item_id ? String(item.stable_item_id) : null;

        // If this stableId was present in oldItemsMap, preserve created_at/created_by
        let preservedCreatedAt = null;
        let preservedCreatedBy = session.user.id; // default for new items

        if (stableId && oldItemsMap.has(stableId)) {
          const oldAudit = oldItemsMap.get(stableId);
          preservedCreatedAt = oldAudit.created_at;     // may be timestamp
          preservedCreatedBy = oldAudit.created_by;     // user id
        } else {
          preservedCreatedAt = null; // will use NOW() in SQL via COALESCE
          preservedCreatedBy = session.user.id;
        }

        // Build placeholder tuple for this item.
        // Note: stable_item_id uses COALESCE($n, gen_random_uuid())
        placeholders.push(`(
          $${i++}, COALESCE($${i++}, gen_random_uuid()), $${i++}, $${i++}, $${i++}, $${i++},
          $${i++}, $${i++}, $${i++}, $${i++}, $${i++},
          $${i++}, $${i++}, $${i++},
          $${i++}, $${i++},
          $${i++}, $${i++},
          $${i++}, $${i++}, $${i++}, $${i++},
          $${i++}, COALESCE($${i++}, NOW()), $${i++}, NOW(), $${i++}
        )`);

        // Push values in exactly the same order as placeholders above
        values.push(
          estimation_id,                     // $n: estimation_id
          stableId,                          // $n+1: stable_item_id (or null)
          item.category,                     // category
          item.room_name,                    // room_name
          item.vendor_type,                  // vendor_type
          item.item_name,                    // item_name
          item.unit,                         // unit
          parseFloat(item.width) || null,    // width
          parseFloat(item.height) || null,   // height
          finalQty,                          // quantity
          parseFloat(item.unit_price) || 0,  // unit_price
          parseFloat(item.subtotal) || 0,    // subtotal
          parseFloat(item.karighar_charges_percentage) || 0, // karighar_charges_percentage
          parseFloat(item.karighar_charges_amount) || 0,     // karighar_charges_amount
          parseFloat(item.item_discount_percentage) || 0,    // item_discount_percentage
          parseFloat(item.item_discount_amount) || 0,        // item_discount_amount
          parseFloat(item.discount_kg_charges_percentage) || 0,
          parseFloat(item.discount_kg_charges_amount) || 0,
          parseFloat(item.gst_percentage) || 0,
          parseFloat(item.gst_amount) || 0,
          parseFloat(item.amount_before_gst) || 0,
          parseFloat(item.item_total) || 0,
          ESTIMATION_ITEM_STATUS.QUEUED,  // status
          preservedCreatedAt,             // created_at (or null -> SQL uses NOW())
          preservedCreatedBy,             // created_by (user id)
          session.user.id                 // updated_by
        );
      }

      // Run the bulk insert
      await query(
        `INSERT INTO estimation_items (${insertCols}) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    // 5️⃣ Update estimation header totals and metadata
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
      estimation_id,
      JSON.stringify(categoryBreakdown),
      itemsValue, kgCharges, itemsDiscount, kgDiscount, discount, gstAmount, finalValue,
      hasOverpayment, overpaymentAmount,
      body.remarks,
      session.user.id
    ]);

    // 6️⃣ Commit
    await query('COMMIT');

    console.log(`Estimation ${estimation_id} updated successfully, version ${nextVersion}`);

    // Return response (including overpayment warning when relevant)
    if (hasOverpayment) {
      return NextResponse.json({
        success: true,
        message: 'Estimation updated successfully',
        estimation_id,
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
      estimation_id,
      version: nextVersion
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('PUT /estimations error:', error);
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
