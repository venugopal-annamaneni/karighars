import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';


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

  // Get project's BizModel
  const projectRes = await query('SELECT biz_model_id FROM projects WHERE id = $1', [body.project_id]);
  const bizModelId = projectRes.rows[0]?.biz_model_id;

  let serviceChargePercentage = body.service_charge_percentage || 0;
  let maxDiscountPercentage = 5; // default

  if (bizModelId) {
    const bizModelRes = await query('SELECT service_charge_percentage, max_discount_percentage FROM biz_models WHERE id = $1', [bizModelId]);
    if (bizModelRes.rows.length > 0) {
      if (!body.service_charge_percentage) {
        serviceChargePercentage = bizModelRes.rows[0].service_charge_percentage;
      }
      maxDiscountPercentage = bizModelRes.rows[0].max_discount_percentage;
    }
  }

  // Calculate from subtotal (total_value is raw sum before service charge/discount)
  const subtotal = parseFloat(body.total_value) || 0;
  const discountPercentage = parseFloat(body.discount_percentage) || 0;
  const serviceChargeAmount = (subtotal * serviceChargePercentage) / 100;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const finalValue = subtotal + serviceChargeAmount - discountAmount;

  // Calculate GST (default 18% if not provided)
  const gstPercentage = parseFloat(body.gst_percentage) || 18.00;
  const gstAmount = (finalValue * gstPercentage) / 100;
  const grandTotal = finalValue + gstAmount;

  // Check for overpayment (only for revision, not first estimation)
  let hasOverpayment = false;
  let overpaymentAmount = 0;

  if (nextVersion > 1) {
    // Get total approved payments
    const paymentsRes = await query(`
          SELECT COALESCE(SUM(amount), 0) as total_collected
          FROM customer_payments
          WHERE project_id = $1 AND status = 'approved'
        `, [body.project_id]);

    const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);

    if (totalCollected > grandTotal) {
      hasOverpayment = true;
      overpaymentAmount = totalCollected - grandTotal;
    }
  }

  // Check if discount exceeds limit
  const requiresApproval = discountPercentage > maxDiscountPercentage;
  const approvalStatus = requiresApproval ? 'pending' : 'approved';

  const result = await query(
    `INSERT INTO project_estimations (
          project_id, version, total_value, woodwork_value, misc_internal_value, misc_external_value, 
          service_charge_percentage, service_charge_amount, discount_percentage, discount_amount, final_value,
          gst_percentage, gst_amount,
          requires_approval, approval_status, 
          has_overpayment, overpayment_amount,
          remarks, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
    [body.project_id, nextVersion, subtotal, body.woodwork_value || 0,
    body.misc_internal_value || 0, body.misc_external_value || 0,
      serviceChargePercentage, serviceChargeAmount, discountPercentage, discountAmount, finalValue,
      gstPercentage, gstAmount,
      requiresApproval, approvalStatus,
      hasOverpayment, overpaymentAmount,
    body.remarks, body.status || 'draft', session.user.id]
  );

  // Add estimation items if provided
  if (body.items && body.items.length > 0) {
    for (const item of body.items) {
      await query(
        `INSERT INTO estimation_items (estimation_id, category, description, quantity, unit, unit_price, vendor_type, estimated_cost, estimated_margin)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [result.rows[0].id, item.category, item.description, item.quantity, item.unit,
        item.unit_price, item.vendor_type, item.estimated_cost, item.estimated_margin]
      );
    }
  }

  // If overpayment detected, return warning (DO NOT create credit note yet)
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