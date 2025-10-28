import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PAYMENT_STATUS } from '@/app/constants';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = params.id;
    const milestoneId = searchParams.get('milestone_id');

    // Get project's BizModel to fetch category definitions
    const projectRes = await query(`
      SELECT p.biz_model_id, bm.category_rates
      FROM projects p
      JOIN biz_models bm ON p.biz_model_id = bm.id
      WHERE p.id = $1
    `, [projectId]);

    if (projectRes.rows.length === 0) {
      return NextResponse.json({ error: 'Project or BizModel not found' }, { status: 404 });
    }

    const categoryRates = projectRes.rows[0].category_rates;
    const categories = categoryRates?.categories || [];

    if (categories.length === 0) {
      return NextResponse.json({ error: 'No categories defined in BizModel' }, { status: 400 });
    }

    // Get latest estimation with category breakdown
    const estRes = await query(`
      SELECT id, category_breakdown, final_value
      FROM project_estimations
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [projectId]);

    if (estRes.rows.length === 0) {
      return NextResponse.json({ error: 'No estimation found' }, { status: 404 });
    }

    const estimation = estRes.rows[0];
    const categoryBreakdown = estimation.category_breakdown || {};

    // Get milestone details with dynamic category percentages
    const milestoneRes = await query(`
      SELECT milestone_code, milestone_name, category_percentages
      FROM biz_model_milestones
      WHERE id = $1
    `, [milestoneId]);

    if (milestoneRes.rows.length === 0) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const milestone = milestoneRes.rows[0];
    const categoryPercentages = milestone.category_percentages || {};

    // Calculate target amounts dynamically for all categories
    const categoryCalculations = {};
    let targetTotal = 0;

    categories
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(category => {
        const categoryId = category.id;
        const categoryTotal = categoryBreakdown[categoryId]?.total || 0;
        const categoryPercentage = categoryPercentages[categoryId] || 0;
        const targetAmount = (categoryTotal * categoryPercentage) / 100;

        categoryCalculations[categoryId] = {
          category_name: category.category_name,
          sort_order: category.sort_order || 0,
          total: parseFloat(categoryTotal),
          target_percentage: parseFloat(categoryPercentage),
          target_amount: parseFloat(targetAmount.toFixed(2))
        };

        targetTotal += targetAmount;
      });

    // Get total payments collected so far
    const paymentsRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as collected_total
      FROM customer_payments
      WHERE project_id = $1 AND status = $2
    `, [projectId, PAYMENT_STATUS.APPROVED]);

    const collectedTotal = parseFloat(paymentsRes.rows[0].collected_total || 0);
    const remainingTotal = Math.max(0, targetTotal - collectedTotal);

    return NextResponse.json({
      milestone_type: 'regular',
      milestone_code: milestone.milestone_code,
      milestone_name: milestone.milestone_name,
      categories: categoryCalculations,
      target_total: parseFloat(targetTotal.toFixed(2)),
      collected_total: parseFloat(collectedTotal.toFixed(2)),
      expected_total: parseFloat(remainingTotal.toFixed(2))
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}