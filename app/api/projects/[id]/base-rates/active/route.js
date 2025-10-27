import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

// GET: Fetch active base_rate for a project
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = params;

  try {
    const result = await query(
      `SELECT * FROM project_base_rates 
       WHERE project_id = $1 AND active = true
       LIMIT 1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No active base rate found for this project' },
        { status: 404 }
      );
    }

    return NextResponse.json({ activeRate: result.rows[0] });
  } catch (error) {
    console.error('Error fetching active base rate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active base rate' },
      { status: 500 }
    );
  }
}
