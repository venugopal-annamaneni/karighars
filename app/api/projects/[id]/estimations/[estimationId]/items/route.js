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
    const result = await query(`
        SELECT * FROM estimation_items
        WHERE estimation_id = $1
        ORDER BY 
          room_name ASC,
          CASE 
              WHEN category = 'woodwork' THEN 1
              WHEN category = 'misc_internal' THEN 2
              WHEN category = 'misc_external' THEN 3
              WHEN category = 'shopping_service' THEN 4
              ELSE 5
          END,
          updated_at DESC NULLS LAST;
      `, [estimationId]);
    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}