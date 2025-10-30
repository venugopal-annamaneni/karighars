import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // Get all versions for this project with user info
    const versionsRes = await query(`
      SELECT 
        pe.id,
        pe.version,
        pe.source,
        pe.is_active,
        pe.final_value,
        pe.created_at,
        pe.csv_file_path,
        u.name as created_by_name,
        u.email as created_by_email,
        (SELECT COUNT(*) FROM estimation_items WHERE estimation_id = pe.id) as items_count
      FROM project_estimations pe
      LEFT JOIN users u ON pe.uploaded_by = u.id
      WHERE pe.project_id = $1
      ORDER BY pe.version DESC
    `, [projectId]);

    const versions = versionsRes.rows.map(v => ({
      id: v.id,
      version: v.version,
      is_active: v.is_active,
      source: v.source,
      items_count: parseInt(v.items_count) || 0,
      final_value: parseFloat(v.final_value) || 0,
      created_at: v.created_at,
      created_by: v.created_by_name || v.created_by_email || 'Unknown',
      csv_available: !!v.csv_file_path
    }));

    return NextResponse.json({
      versions: versions,
      latest_version: versions.length > 0 ? versions[0].version : null,
      has_estimations: versions.length > 0
    });

  } catch (error) {
    console.error('Versions list error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch versions', 
      message: error.message 
    }, { status: 500 });
  }
}
