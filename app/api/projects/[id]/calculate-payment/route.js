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
      // SHOPPING_100 milestone: Calculate from shopping_service items only
      const itemsRes = await query(`
        SELECT COALESCE(SUM(item_total), 0) as shopping_total
        FROM estimation_items
        WHERE estimation_id = $1 AND category = 'shopping_service'
      `, [estimationId]);

      const shoppingTotal = parseFloat(itemsRes.rows[0].shopping_total || 0);
      const shoppingPercentage = parseFloat(milestone.shopping_percentage || 0);
      
      // Calculate target amount
      const targetAmount = (shoppingTotal * shoppingPercentage) / 100;

      // Get total collected for shopping payments (payment_type = 'SHOPPING_100')
      const paymentsRes = await query(`
        SELECT COALESCE(SUM(amount), 0) as collected
        FROM customer_payments
        WHERE project_id = $1 
          AND status = 'approved'
          AND payment_type = 'SHOPPING_100'
      `, [projectId]);

      const collectedAmount = parseFloat(paymentsRes.rows[0].collected || 0);
      const remainingAmount = Math.max(0, targetAmount - collectedAmount);

      return NextResponse.json({
        milestone_type: 'shopping',
        milestone_code: milestone.milestone_code,
        milestone_name: milestone.milestone_name,
        target_percentage: shoppingPercentage,
        target_amount: targetAmount,
        collected_amount: collectedAmount,
        remaining_amount: remainingAmount,
        expected_payment: remainingAmount,
        // Breakdown for UI display only (not stored in DB)
        display_breakdown: {
          shopping_service: shoppingTotal,
          shopping_percentage: shoppingPercentage
        }
      });

    } else {
      // Regular milestone: Calculate from woodwork + misc items (exclude shopping)
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

      // Calculate target amounts for this milestone
      const targetWoodworkAmount = (woodworkTotal * woodworkPercentage) / 100;
      const targetMiscAmount = (miscTotal * miscPercentage) / 100;
      const targetAmount = targetWoodworkAmount + targetMiscAmount;

      // Get total collected for regular payments (exclude SHOPPING_100)
      const paymentsRes = await query(`
        SELECT COALESCE(SUM(amount), 0) as collected
        FROM customer_payments
        WHERE project_id = $1 
          AND status = 'approved'
          AND payment_type != 'SHOPPING_100'
      `, [projectId]);

      const collectedAmount = parseFloat(paymentsRes.rows[0].collected || 0);
      const remainingAmount = Math.max(0, targetAmount - collectedAmount);

      return NextResponse.json({
        milestone_type: 'regular',
        milestone_code: milestone.milestone_code,
        milestone_name: milestone.milestone_name,
        target_percentage: Math.max(woodworkPercentage, miscPercentage),
        target_amount: targetAmount,
        collected_amount: collectedAmount,
        remaining_amount: remainingAmount,
        expected_payment: remainingAmount,
        // Breakdown for UI display only (not stored in DB)
        display_breakdown: {
          woodwork_total: woodworkTotal,
          misc_total: miscTotal,
          woodwork_percentage: woodworkPercentage,
          misc_percentage: miscPercentage,
          target_woodwork_amount: targetWoodworkAmount,
          target_misc_amount: targetMiscAmount
        }
      });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}