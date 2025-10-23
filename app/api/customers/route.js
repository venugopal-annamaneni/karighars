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
        *,
        COUNT(*) OVER() AS total_records
        FROM customers c
        WHERE 
          ($1 = '' OR 
          c.name ILIKE $2 OR 
          c.email ILIKE $2 OR 
          c.phone ILIKE $2)
        ORDER BY c.name
        LIMIT $3 OFFSET $4`,
      [filter, filterValue, pageSize, offset]    
    );
    return NextResponse.json({ customers: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();

  try {
    const result = await query(
      `INSERT INTO customers (name, contact_person, phone, email, address, gst_number, kyc_type, business_type, bank_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [body.name, body.contact_person, body.phone, body.email, body.address, body.gst_number,
      body.kyc_type || null, body.business_type || null, JSON.stringify(body.bank_details || {})]
    );
    return NextResponse.json({ customer: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}