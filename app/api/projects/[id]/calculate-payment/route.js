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

    // Get latest estimation
    const estRes = await query(`
      SELECT id, woodwork_value, misc_internal_value, misc_external_value, shopping_service_value, final_value
      FROM project_estimations
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [projectId]);

    if (estRes.rows.length === 0) {
      return NextResponse.json({ error: 'No estimation found' }, { status: 404 });
    }

    const estimation = estRes.rows[0];
    const estimationId = estimation.id;

    // Get milestone details
    const milestoneRes = await query(`
      SELECT milestone_code, milestone_name, woodwork_percentage, misc_percentage, shopping_percentage
      FROM biz_model_milestones
      WHERE id = $1
    `, [milestoneId]);

    if (milestoneRes.rows.length === 0) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const milestone = milestoneRes.rows[0];
    const isShoppingMilestone = milestone.milestone_code === 'SHOPPING_100';

    if (isShoppingMilestone) {
      // SHOPPING_100 milestone: Only include shopping_service items
      const itemsRes = await query(`
        SELECT COALESCE(SUM(item_total), 0) as shopping_total
        FROM estimation_items
        WHERE estimation_id = $1 AND category = 'shopping_service'
      `, [estimationId]);

      const shoppingTotal = parseFloat(itemsRes.rows[0].shopping_total || 0);
      const shoppingPercentage = parseFloat(milestone.shopping_percentage || 0);
      
      // Calculate target amount for this milestone
      const targetAmount = (shoppingTotal * shoppingPercentage) / 100;

      // Get already collected for shopping
      const paymentsRes = await query(`
        SELECT COALESCE(SUM(amount), 0) as collected
        FROM customer_payments
        WHERE project_id = $1 
          AND status = 'approved'
          AND payment_type = 'SHOPPING_100'
      `, [projectId]);

      const collected = parseFloat(paymentsRes.rows[0].collected || 0);
      const collectedPercentage = shoppingTotal > 0 ? (collected / shoppingTotal) * 100 : 0;
      const remainingPercentage = Math.max(0, shoppingPercentage - collectedPercentage);
      const remainingAmount = Math.max(0, targetAmount - collected);

      return NextResponse.json({
        milestone_type: 'shopping',
        milestone_code: milestone.milestone_code,
        milestone_name: milestone.milestone_name,
        shopping_total: shoppingTotal,
        target_percentage: shoppingPercentage,
        target_amount: targetAmount,
        collected_amount: collected,
        collected_percentage: collectedPercentage,
        remaining_percentage: remainingPercentage,
        remaining_amount: remainingAmount,
        expected_payment: remainingAmount,
        breakdown: {
          shopping_service: remainingAmount
        }
      });

    } else {
      // Regular milestone: EXCLUDE shopping_service items
      const itemsRes = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN category = 'woodwork' THEN item_total ELSE 0 END), 0) as woodwork_total,
          COALESCE(SUM(CASE WHEN category IN ('misc_internal', 'misc_external') THEN item_total ELSE 0 END), 0) as misc_total
        FROM estimation_items
        WHERE estimation_id = $1 AND category != 'shopping_service'
      `, [estimationId]);

      const woodworkTotal = parseFloat(itemsRes.rows[0].woodwork_total || 0);
      const miscTotal = parseFloat(itemsRes.rows[0].misc_total || 0);

      const woodworkPercentage = parseFloat(milestone.woodwork_percentage || 0);
      const miscPercentage = parseFloat(milestone.misc_percentage || 0);

      // Calculate target amounts for this milestone (cumulative)
      const targetWoodworkAmount = (woodworkTotal * woodworkPercentage) / 100;
      const targetMiscAmount = (miscTotal * miscPercentage) / 100;
      const targetTotal = targetWoodworkAmount + targetMiscAmount;

      // Get already collected amounts (excluding shopping payments)
      const paymentsRes = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN payment_type != 'SHOPPING_100' THEN woodwork_amount ELSE 0 END), 0) as collected_woodwork,
          COALESCE(SUM(CASE WHEN payment_type != 'SHOPPING_100' THEN misc_amount ELSE 0 END), 0) as collected_misc
        FROM customer_payments
        WHERE project_id = $1 AND status = 'approved'
      `, [projectId]);

      const collectedWoodwork = parseFloat(paymentsRes.rows[0].collected_woodwork || 0);
      const collectedMisc = parseFloat(paymentsRes.rows[0].collected_misc || 0);
      const collectedTotal = collectedWoodwork + collectedMisc;

      // Calculate collected percentages
      const collectedWoodworkPercentage = woodworkTotal > 0 ? (collectedWoodwork / woodworkTotal) * 100 : 0;
      const collectedMiscPercentage = miscTotal > 0 ? (collectedMisc / miscTotal) * 100 : 0;

      // Calculate remaining
      const remainingWoodworkPercentage = Math.max(0, woodworkPercentage - collectedWoodworkPercentage);
      const remainingMiscPercentage = Math.max(0, miscPercentage - collectedMiscPercentage);
      
      const remainingWoodworkAmount = Math.max(0, targetWoodworkAmount - collectedWoodwork);
      const remainingMiscAmount = Math.max(0, targetMiscAmount - collectedMisc);
      const remainingTotal = remainingWoodworkAmount + remainingMiscAmount;

      return NextResponse.json({
        milestone_type: 'regular',
        milestone_code: milestone.milestone_code,
        milestone_name: milestone.milestone_name,
        woodwork_total: woodworkTotal,
        misc_total: miscTotal,
        target_woodwork_percentage: woodworkPercentage,
        target_misc_percentage: miscPercentage,
        target_woodwork_amount: targetWoodworkAmount,
        target_misc_amount: targetMiscAmount,
        target_total: targetTotal,
        collected_woodwork_amount: collectedWoodwork,
        collected_misc_amount: collectedMisc,
        collected_total: collectedTotal,
        collected_woodwork_percentage: collectedWoodworkPercentage,
        collected_misc_percentage: collectedMiscPercentage,
        remaining_woodwork_percentage: remainingWoodworkPercentage,
        remaining_misc_percentage: remainingMiscPercentage,
        remaining_woodwork_amount: remainingWoodworkAmount,
        remaining_misc_amount: remainingMiscAmount,
        remaining_total: remainingTotal,
        expected_payment: remainingTotal,
        breakdown: {
          woodwork: remainingWoodworkAmount,
          misc: remainingMiscAmount
        }
      });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}