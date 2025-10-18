const { Pool } = require('pg');
const fs = require('fs');

async function truncateProjects() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('⚠️  WARNING: About to truncate ALL project data!');
    console.log('Reading SQL file...');
    
    const sql = fs.readFileSync('/app/truncate_all_projects.sql', 'utf8');
    
    console.log('Executing truncation...');
    const result = await pool.query(sql);
    
    console.log('✅ All project data has been truncated successfully');
    console.log('✅ Sequences reset to start from 1');
    
    // Verify by counting
    const countResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM projects) as projects_count,
        (SELECT COUNT(*) FROM project_estimations) as estimations_count,
        (SELECT COUNT(*) FROM customer_payments_in) as payments_count
    `);
    
    console.log('\nVerification:');
    console.log('Projects:', countResult.rows[0].projects_count);
    console.log('Estimations:', countResult.rows[0].estimations_count);
    console.log('Payments:', countResult.rows[0].payments_count);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

truncateProjects();
