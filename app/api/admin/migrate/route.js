import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
  }

  try {
    const sqlPath = path.join(process.cwd(), 'alter_kyc_gst_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying schema updates...');
    await query(sql);
    console.log('✅ Schema updates applied successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Schema updates applied successfully' 
    });
  } catch (error) {
    console.error('❌ Error applying schema:', error);
    return NextResponse.json({ 
      error: error.message,
      details: 'Failed to apply schema updates'
    }, { status: 500 });
  }
}
