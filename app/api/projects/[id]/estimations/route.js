import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { ESTIMATION_STATUS, PAYMENT_STATUS, ESTIMATION_ITEM_STATUS } from '@/app/constants';


export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Get next version number
  const versionResult = await query(
    'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM project_estimations WHERE project_id = $1',
    [body.project_id]
  );
  const nextVersion = versionResult.rows[0].next_version;

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
    const result = await query(
      `INSERT INTO project_estimations (
      project_id, created_by, version,
      category_breakdown,
      items_value, kg_charges, items_discount, kg_discount, discount, gst_amount, 
      final_value,
      has_overpayment, overpayment_amount,
      remarks
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        body.project_id, session.user.id, nextVersion, 
        JSON.stringify(categoryBreakdown),
        itemsValue, kgCharges, itemsDiscount, kgDiscount, discount, gstAmount,
        finalValue,
        hasOverpayment, overpaymentAmount,
        body.remarks,
      ]
    );

    // Add estimation items with all calculated fields including room_name, unit, width, height
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        // Calculate quantity based on unit type
        let finalQuantity = item.quantity;
        if (item.unit === 'sqft' && item.width && item.height) {
          finalQuantity = parseFloat(item.width) * parseFloat(item.height);
        }
        await query(
          `INSERT INTO estimation_items (
          estimation_id, category, room_name, vendor_type, item_name, 
          unit, width, height, quantity, unit_price,
          subtotal, karighar_charges_percentage, karighar_charges_amount, item_discount_percentage, item_discount_amount, 
          discount_kg_charges_percentage, discount_kg_charges_amount, gst_percentage, gst_amount, amount_before_gst, item_total,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            result.rows[0].id, item.category, item.room_name, item.vendor_type, item.item_name,
            item.unit, parseFloat(item.width) || null, parseFloat(item.height) || null, parseFloat(finalQuantity), parseFloat(item.unit_price),
            parseFloat(item.subtotal), parseFloat(item.karighar_charges_percentage), parseFloat(item.karighar_charges_amount), parseFloat(item.item_discount_percentage), parseFloat(item.item_discount_amount),
            parseFloat(item.discount_kg_charges_percentage), parseFloat(item.discount_kg_charges_amount), parseFloat(item.gst_percentage), parseFloat(item.gst_amount), parseFloat(item.amount_before_gst), parseFloat(item.item_total)
          ]
        );
      }
    }

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
    await query("COMMIT");
    return NextResponse.json({ estimation: result.rows[0] });

  } catch (error) {
    await query("ROLLBACK");
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projectId = params.id;
    const result = await query(`
        SELECT e.*, u.name as created_by_name
        FROM project_estimations e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.project_id = $1
        ORDER BY e.version DESC
      `, [projectId]);
    return NextResponse.json({ estimations: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}