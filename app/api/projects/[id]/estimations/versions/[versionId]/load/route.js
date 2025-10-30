import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const version = parseInt(params.versionId);

  if (isNaN(version)) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }

  try {
    // Get estimation record to find CSV file path
    const estimationRes = await query(`
      SELECT id, version, csv_file_path
      FROM project_estimations
      WHERE project_id = $1 AND version = $2
    `, [projectId, version]);

    if (estimationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const estimation = estimationRes.rows[0];
    let csvFilePath = estimation.csv_file_path;

    if (!csvFilePath) {
      return NextResponse.json({ 
        error: 'No CSV file available for this version' 
      }, { status: 404 });
    }

    // Try to find the CSV file
    const fullPath = path.join(process.cwd(), csvFilePath);
    
    if (!existsSync(fullPath)) {
      // Try export CSV
      const exportPath = csvFilePath.replace('_upload.csv', '_export.csv');
      const fullExportPath = path.join(process.cwd(), exportPath);
      
      if (existsSync(fullExportPath)) {
        csvFilePath = exportPath;
      } else {
        return NextResponse.json({ 
          error: 'CSV file not found' 
        }, { status: 404 });
      }
    }

    // Read CSV file
    const csvContent = await readFile(path.join(process.cwd(), csvFilePath), 'utf-8');

    // Return CSV file for download
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="project_${projectId}_v${version}.csv"`
      }
    });

  } catch (error) {
    console.error('CSV download error:', error);
    return NextResponse.json({ 
      error: 'Failed to download CSV', 
      message: error.message 
    }, { status: 500 });
  }
}
