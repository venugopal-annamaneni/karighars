import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { PAYMENT_STATUS, USER_ROLE } from '@/app/constants';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  if (!type) {
    return NextResponse.json({ error: "Invalid Request. Type parameter is missing." }, { status: 404 });
  }

  try {

    if (type === 'customer') {
      let queryText = `
        SELECT cp.*, 
               p.name as project_name, 
               c.name as customer_name, 
               u.name as created_by_name,
               approver.name as approved_by_name
        FROM customer_payments cp
        LEFT JOIN projects p ON cp.project_id = p.id
        LEFT JOIN customers c ON cp.customer_id = c.id
        LEFT JOIN users u ON cp.created_by = u.id
        LEFT JOIN users approver ON cp.approved_by = approver.id
        ORDER BY cp.payment_date DESC
      `;
      const result = await query(queryText);
      return NextResponse.json({ payments: result.rows });
    } else {
      let queryText = `
        SELECT vp.*, v.name as vendor_name, p.name as project_name, u.name as created_by_name
        FROM payments_out vp
        LEFT JOIN vendors v ON vp.vendor_id = v.id
        LEFT JOIN projects p ON vp.project_id = p.id
        LEFT JOIN users u ON vp.created_by = u.id
      `;
      const result = await query(queryText);
      return NextResponse.json({ payments: result.rows });
    }



  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}