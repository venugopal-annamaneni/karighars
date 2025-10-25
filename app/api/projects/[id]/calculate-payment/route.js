import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PAYMENT_STATUS } from '@/lib/constants';

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
    
    const itemsRes = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN category = 'woodwork' THEN item_total ELSE 0 END), 0) as woodwork_total,
          COALESCE(SUM(CASE WHEN category IN ('misc_internal', 'misc_external') THEN item_total ELSE 0 END), 0) as misc_total,
          COALESCE(SUM(CASE WHEN category IN ('shopping_service') THEN item_total ELSE 0 END), 0) as shopping_total
        FROM estimation_items
        WHERE estimation_id = $1
      `, [estimationId]);

    const woodworkTotal = parseFloat(itemsRes.rows[0].woodwork_total || 0);
    const miscTotal = parseFloat(itemsRes.rows[0].misc_total || 0);
    const shoppingTotal = parseFloat(itemsRes.rows[0].shopping_total || 0);

    const woodworkPercentage = parseFloat(milestone.woodwork_percentage || 0);
    const miscPercentage = parseFloat(milestone.misc_percentage || 0);
    const shoppingPercentage = parseFloat(milestone.shopping_percentage || 0);

    // Calculate target amounts for this milestone
    const targetWoodworkAmount = (woodworkTotal * woodworkPercentage) / 100;
    const targetMiscAmount = (miscTotal * miscPercentage) / 100;
    const targetShoppingAmount = (shoppingTotal * shoppingPercentage) / 100;
    const targetTotal = targetWoodworkAmount + targetMiscAmount + targetShoppingAmount;

    const paymentsRes = await query(`
        SELECT 
          COALESCE(SUM(amount), 0) as collected_total
        FROM customer_payments
        WHERE project_id = $1 
          AND status = $2
      `, [projectId, PAYMENT_STATUS.APPROVED]);

    const collectedTotal = paymentsRes.rows[0].collected_total || 0;
    const remainingTotal = Math.max(0, targetTotal - collectedTotal);


    return NextResponse.json({
      milestone_type: 'regular',
      milestone_code: milestone.milestone_code,
      milestone_name: milestone.milestone_name,

      woodwork_total: woodworkTotal,
      target_woodwork_percentage: woodworkPercentage,
      target_woodwork_amount: targetWoodworkAmount,

      misc_total: miscTotal,
      target_misc_percentage: miscPercentage,
      target_misc_amount: targetMiscAmount,

      shopping_total: shoppingTotal,
      target_shopping_percentage: shoppingPercentage,
      target_shopping_amount: targetShoppingAmount,

      target_total: targetTotal,
      collected_total: collectedTotal,
      expected_total: remainingTotal
    });


  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}