// Run migration 027
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.MONGO_URL || process.env.DATABASE_URL;

async function runMigration() {
  const pool = new Pool({ connectionString });
  
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '027_migrate_to_stable_ids_only.sql'),
      'utf8'
    );
    
    console.log('Running migration 027: Migrate to stable IDs only...');
    await pool.query(migrationSQL);
    console.log('✅ Migration 027 completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
