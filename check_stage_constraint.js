const { Pool } = require('pg');
require('dotenv').config();

async function checkConstraints() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? { rejectUnauthorized: false } : undefined
  });

  try {
    const result = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'projects'::regclass 
        AND contype = 'c'
        AND conname LIKE '%stage%'
    `);
    
    console.log('Stage-related CHECK constraints on projects table:');
    console.log(result.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkConstraints();
