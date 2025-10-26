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
    const groupId = searchParams.get("group_id");
    const groupType = searchParams.get("group_type");

    if (groupId && groupType) {

      const result = await query(`
              SELECT d.*, u.name as uploaded_by_name
              FROM documents d
              LEFT JOIN users u ON d.uploaded_by = u.id
              WHERE d.group_type = $1 and group_id = $2
              ORDER BY d.created_at DESC
            `, [groupType, groupId]);

      return NextResponse.json({ documents: result.rows });
    } else {
      return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }
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
      `INSERT INTO documents (group_type, group_id, related_entity, related_id, l, document_url, file_name, file_size, mime_type, uploaded_by, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [body.group_type, body.group_id, body.related_entity, body.related_id, body.document_type, body.document_url,
        body.file_name, body.file_size, body.mime_type, session.user.id,
        body.remarks || null]
    );

    return NextResponse.json({ document: result.rows[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}