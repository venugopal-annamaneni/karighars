import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, versionId } = params;

    // Verify the version exists in the database
    const versionQuery = `
      SELECT version, created_at
      FROM project_estimations
      WHERE project_id = $1 AND version = $2
    `;
    const versionResult = await db.query(versionQuery, [projectId, parseInt(versionId)]);

    if (versionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Construct the file path
    const filePath = path.join(process.cwd(), 'uploads', 'estimations', projectId, `${versionId}.csv`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ 
        error: 'CSV file not found for this version' 
      }, { status: 404 });
    }

    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Return the CSV file with appropriate headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="estimation_v${versionId}_project_${projectId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error downloading version CSV:', error);
    return NextResponse.json({ 
      error: 'Failed to download version CSV',
      details: error.message 
    }, { status: 500 });
  }
}
