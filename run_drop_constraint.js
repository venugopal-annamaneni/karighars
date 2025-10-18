const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sql = fs.readFileSync('/app/drop_stage_check_constraint.sql', 'utf8');
    console.log('Executing migration...');
    await pool.query(sql);
    console.log('✅ Successfully dropped projects_phase_check constraint');
    
    // Verify it's gone
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint 
      WHERE conrelid = 'projects'::regclass 
        AND contype = 'c'
        AND conname = 'projects_phase_check'
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ Verified: Constraint has been removed');
    } else {
      console.log('⚠️ Warning: Constraint still exists');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
