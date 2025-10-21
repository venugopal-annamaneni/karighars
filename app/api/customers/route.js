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
        SELECT * FROM customers
        ORDER BY created_at DESC
      `);
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