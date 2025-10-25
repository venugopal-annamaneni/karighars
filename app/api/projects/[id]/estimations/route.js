import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { ESTIMATION_STATUS, PAYMENT_STATUS } from '@/app/constants';


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

  // Totals are now calculated at item level and passed from frontend
  const woodworkValue = parseFloat(body.woodwork_value) || 0;
  const miscInternalValue = parseFloat(body.misc_internal_value) || 0;
  const miscExternalValue = parseFloat(body.misc_external_value) || 0;
  const shoppingServiceValue = parseFloat(body.shopping_service_value) || 0;
  const serviceCharge = parseFloat(body.service_charge) || 0;
  const discount = parseFloat(body.discount) || 0;
  const gstAmount = parseFloat(body.gst_amount) || 0;
  const finalValue = parseFloat(body.final_value) || 0;

  // Check for overpayment (only for revision, not first estimation)
  let hasOverpayment = false;
  let overpaymentAmount = 0;

  if (nextVersion > 1) {
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
  }

  const result = await query(
    `INSERT INTO project_estimations (
      project_id, version, 
      woodwork_value, misc_internal_value, misc_external_value, shopping_service_value,
      service_charge, discount, gst_amount, final_value,
      has_overpayment, overpayment_amount,
      remarks, status, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [
      body.project_id, nextVersion,
      woodworkValue, miscInternalValue, miscExternalValue, shoppingServiceValue,
      serviceCharge, discount, gstAmount, finalValue,
      hasOverpayment, overpaymentAmount,
      body.remarks, body.status || ESTIMATION_STATUS.DRAFT, session.user.id
    ]
  );

  // Add estimation items with all calculated fields
  if (body.items && body.items.length > 0) {
    for (const item of body.items) {
      console.log(item);
      await query(
        `INSERT INTO estimation_items (
          estimation_id, category, description, quantity, unit, unit_price,
          karighar_charges_percentage, discount_percentage, gst_percentage,
          subtotal, karighar_charges_amount, discount_amount, amount_before_gst, gst_amount, item_total,
          vendor_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          result.rows[0].id, item.category, item.description, item.quantity, item.unit, item.unit_price,
          item.karighar_charges_percentage, item.discount_percentage, item.gst_percentage,
          item.subtotal, item.karighar_charges_amount, item.discount_amount, item.amount_before_gst, item.gst_amount, item.item_total,
          item.vendor_type
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

  return NextResponse.json({ estimation: result.rows[0] });
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