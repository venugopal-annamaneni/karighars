import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageNo = Number(searchParams.get("page_no") || 1);
  const pageSize = Number(searchParams.get("page_size") || 20);
  const offset = (pageNo - 1) * pageSize;

  const filter = searchParams.get("filter")?.trim() || "";
  const filterValue = `%${filter}%`;

  try {
    const result = await query(`
          SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.role, 
          u.active, 
          u.created_at,
          COUNT(*) OVER() AS total_records
        FROM users u
        WHERE 
          ($1 = '' OR 
          u.name ILIKE $2 OR 
          u.email ILIKE $2 OR 
          u.role ILIKE $2)
        ORDER BY u.name
        LIMIT $3 OFFSET $4`,
      [filter, filterValue, pageSize, offset]
    );
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}