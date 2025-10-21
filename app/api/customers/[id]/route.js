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
    const customerId = params.id;
    const result = await query(`
        SELECT * FROM customers WHERE id = $1
      `, [customerId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const path = params.path ? params.path.join('/') : '';
  // Parse body only if request has content
  let body = {};
  try {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      body = await request.json();
    }
  } catch (error) {
    // No body or invalid JSON, use empty object
    body = {};
  }

  try {

    // Update Customer

    const customerId = params.id;
    const result = await query(
      `UPDATE customers 
         SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5, 
             gst_number = $6, kyc_type = $7, business_type = $8, bank_details = $9
         WHERE id = $10 RETURNING *`,
      [body.name, body.contact_person, body.phone, body.email, body.address,
      body.gst_number, body.kyc_type, body.business_type, JSON.stringify(body.bank_details || {}), customerId]
    );

    return NextResponse.json({ customer: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}