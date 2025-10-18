const { Pool } = require('pg');

async function checkConstraints() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'projects'::regclass 
        AND contype = 'c'
    `);
    
    console.log('ALL CHECK constraints on projects table:');
    console.log(JSON.stringify(result.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkConstraints();
