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
    const projectId = params.id;

    if (projectId) {

      const result = await query(`
              SELECT d.*, u.name as uploaded_by_name
              FROM documents d
              LEFT JOIN users u ON d.uploaded_by = u.id
              WHERE d.project_id = $1
              ORDER BY d.created_at DESC
            `, [projectId]);

      const documents = await Promise.all(
        result.rows.map(async (doc) => {
          let relatedInfo = null;

          if (doc.related_entity === 'customer_payments') {
            const { rows } = await query(
              `SELECT id, payment_type, amount FROM customer_payments WHERE id = $1`,
              [doc.related_id]
            );
            relatedInfo = rows[0];
          }
          return { ...doc, related_info: relatedInfo };
        })
      );


      return NextResponse.json({ documents });
    } else {
      return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function POST(request, { params }) {
  console.log("here");
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();

  try {
    const result = await query(
      `INSERT INTO documents (project_id, related_entity, related_id, document_type, document_url, file_name, file_size, mime_type, uploaded_by, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [body.project_id, body.related_entity, body.related_id, body.document_type, body.document_url,
      body.file_name, body.file_size, body.mime_type, session.user.id,
      body.remarks || null]
    );

    return NextResponse.json({ document: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


