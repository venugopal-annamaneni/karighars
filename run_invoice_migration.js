const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Running migration: Create project_invoices table...');
    
    const sql = fs.readFileSync('/app/create_invoice_tables.sql', 'utf8');
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully');
    console.log('Created: project_invoices table');
    console.log('Added: invoiced_amount column to projects table');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
