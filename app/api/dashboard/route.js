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
    const output = searchParams.get("output");
    switch (output) {
      case "stats":
        const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
          (SELECT COALESCE(SUM(COALESCE(final_value, total_value) + COALESCE(gst_amount, 0)), 0) 
           FROM project_estimations 
           WHERE status IN ('draft', 'finalized', 'approved')) as total_project_value,
          (SELECT COALESCE(SUM(amount), 0) FROM customer_payments WHERE status = 'approved') as total_received,
          (SELECT COALESCE(SUM(amount), 0) FROM payments_out) as total_paid
      `);
        return NextResponse.json({ stats: stats.rows[0] });
      case "activities":
        const activities = await query(`
        SELECT * FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 20
      `);
        return NextResponse.json({ activities: activities.rows });
      default:
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }


  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
