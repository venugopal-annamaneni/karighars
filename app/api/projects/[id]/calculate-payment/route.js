import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {

    const { searchParams } = new URL(request.url);
    const projectId = params.id;
    const milestoneId = searchParams.get('milestone_id');

    // Get project estimation (including GST and adjustments)
    const estRes = await query(`
        SELECT 
          woodwork_value, 
          misc_internal_value, 
          misc_external_value,
          service_charge_amount,
          discount_amount,
          final_value,
          gst_amount
        FROM project_estimations
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [projectId]);

    if (estRes.rows.length === 0) {
      return NextResponse.json({ error: 'No estimation found' }, { status: 404 });
    }

    const estimation = estRes.rows[0];
    const woodworkValue = parseFloat(estimation.woodwork_value || 0);
    const miscValue = parseFloat(estimation.misc_internal_value || 0) + parseFloat(estimation.misc_external_value || 0);
    const serviceCharge = parseFloat(estimation.service_charge_amount || 0);
    const discount = parseFloat(estimation.discount_amount || 0);
    const finalValue = parseFloat(estimation.final_value || 0);
    const gstAmount = parseFloat(estimation.gst_amount || 0);

    // Calculate how service charge and discount are distributed across categories
    const subtotal = woodworkValue + miscValue;

    // Apply service charge and discount proportionally to woodwork and misc
    const woodworkAfterAdjustments = subtotal > 0
      ? woodworkValue + (woodworkValue / subtotal) * serviceCharge - (woodworkValue / subtotal) * discount
      : 0;
    const miscAfterAdjustments = subtotal > 0
      ? miscValue + (miscValue / subtotal) * serviceCharge - (miscValue / subtotal) * discount
      : 0;

    // Calculate GST portions for woodwork and misc (based on their share of final_value)
    const woodworkGst = finalValue > 0 ? (woodworkAfterAdjustments / finalValue) * gstAmount : 0;
    const miscGst = finalValue > 0 ? (miscAfterAdjustments / finalValue) * gstAmount : 0;

    // Total values INCLUDING GST (this is what customer pays)
    const woodworkValueWithGst = woodworkAfterAdjustments + woodworkGst;
    const miscValueWithGst = miscAfterAdjustments + miscGst;

    // Get milestone config
    const milestoneRes = await query(`
        SELECT milestone_code, woodwork_percentage, misc_percentage
        FROM biz_model_milestones
        WHERE id = $1
      `, [milestoneId]);

    if (milestoneRes.rows.length === 0) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const milestone = milestoneRes.rows[0];

    // Get all APPROVED payments for this project (cumulative)
    // Note: woodwork_amount and misc_amount are stored as pre-tax values
    // We need to add GST back to compare with GST-inclusive targets
    const paymentsRes = await query(`
        SELECT 
          COALESCE(SUM(woodwork_amount * (1 + gst_percentage / 100)), 0) as total_woodwork_with_gst,
          COALESCE(SUM(misc_amount * (1 + gst_percentage / 100)), 0) as total_misc_with_gst
        FROM customer_payments
        WHERE project_id = $1 AND status = 'approved'
      `, [projectId]);

    const collectedWoodwork = parseFloat(paymentsRes.rows[0].total_woodwork_with_gst || 0);
    const collectedMisc = parseFloat(paymentsRes.rows[0].total_misc_with_gst || 0);

    // Calculate collected percentages (based on GST-inclusive values)
    const collectedWoodworkPercentage = woodworkValueWithGst > 0 ? (collectedWoodwork / woodworkValueWithGst) * 100 : 0;
    const collectedMiscPercentage = miscValueWithGst > 0 ? (collectedMisc / miscValueWithGst) * 100 : 0;

    // Calculate remaining to collect
    const targetWoodworkPercentage = parseFloat(milestone.woodwork_percentage || 0);
    const targetMiscPercentage = parseFloat(milestone.misc_percentage || 0);

    const remainingWoodworkPercentage = Math.max(0, targetWoodworkPercentage - collectedWoodworkPercentage);
    const remainingMiscPercentage = Math.max(0, targetMiscPercentage - collectedMiscPercentage);

    // Calculate expected amounts (GST-inclusive) - REMAINING amounts only
    const expectedWoodworkAmount = (woodworkValueWithGst * remainingWoodworkPercentage) / 100;
    const expectedMiscAmount = (miscValueWithGst * remainingMiscPercentage) / 100;
    const expectedTotal = expectedWoodworkAmount + expectedMiscAmount;

    return NextResponse.json({
      woodwork_value: woodworkValueWithGst,
      misc_value: miscValueWithGst,
      target_woodwork_percentage: targetWoodworkPercentage,
      target_misc_percentage: targetMiscPercentage,
      collected_woodwork_amount: collectedWoodwork,
      collected_misc_amount: collectedMisc,
      collected_woodwork_percentage: collectedWoodworkPercentage,
      collected_misc_percentage: collectedMiscPercentage,
      remaining_woodwork_percentage: remainingWoodworkPercentage,
      remaining_misc_percentage: remainingMiscPercentage,
      expected_woodwork_amount: expectedWoodworkAmount,
      expected_misc_amount: expectedMiscAmount,
      expected_total: expectedTotal
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}