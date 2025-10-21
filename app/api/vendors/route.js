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
    const result = await query(`
        SELECT * FROM vendors
        WHERE is_active = true
        ORDER BY name
      `);
    return NextResponse.json({ vendors: result.rows });
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
      `INSERT INTO vendors (name, vendor_type, contact_person, phone, email, gst_number, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.name, body.vendor_type, body.contact_person, body.phone, body.email, body.gst_number, body.address]
    );
    return NextResponse.json({ vendor: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

