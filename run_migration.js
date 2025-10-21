const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Running migration: Item-level calculations...');
    
    const sql = fs.readFileSync('/app/migrate_item_level_calculations.sql', 'utf8');
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
