import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { USER_ROLE } from '@/app/constants';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
  }

  try {
    const { migrationFile } = await request.json();
    const fileName = migrationFile || 'gst_refactor_schema.sql';
    
    const sqlPath = path.join(process.cwd(), fileName);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log(`Applying ${fileName}...`);
    
    // Split by semicolon and execute each statement separately
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim().startsWith('--')) continue; // Skip comments
      try {
        await query(statement);
      } catch (err) {
        console.warn('Statement warning:', err.message);
        // Continue with other statements even if one fails (for IF EXISTS clauses)
      }
    }
    
    console.log('✅ Schema updates applied successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Schema updates applied successfully',
      fileName 
    });
  } catch (error) {
    console.error('❌ Error applying schema:', error);
    return NextResponse.json({ 
      error: error.message,
      details: 'Failed to apply schema updates'
    }, { status: 500 });
  }
}
