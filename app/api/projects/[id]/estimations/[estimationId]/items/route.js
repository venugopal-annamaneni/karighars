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
    const estimationId = params.estimationId;
    const projectId = params.id;

    // Fetch BizModel category_rates to get sort_order
    const bizModelRes = await query(`
      SELECT bm.category_rates
      FROM projects p
      JOIN biz_models bm ON p.biz_model_id = bm.id
      WHERE p.id = $1
    `, [projectId]);

    let orderByClause = 'room_name ASC, category ASC, updated_at DESC NULLS LAST';

    // Build dynamic CASE statement for category sorting if category_rates exists
    if (bizModelRes.rows.length > 0 && bizModelRes.rows[0].category_rates) {
      const categories = bizModelRes.rows[0].category_rates.categories || [];
      
      if (categories.length > 0) {
        const caseClauses = categories
          .map(cat => `WHEN category = '${cat.id}' THEN ${cat.sort_order || 999}`)
          .join(' ');
        
        orderByClause = `room_name ASC, CASE ${caseClauses} ELSE 999 END, updated_at DESC NULLS LAST`;
      }
    }

    const result = await query(`
        SELECT * FROM estimation_items
        WHERE estimation_id = $1
        ORDER BY ${orderByClause};
      `, [estimationId]);
    
    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}