// Run migration 028
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read connection string from .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const mongoUrlMatch = envContent.match(/MONGO_URL=(.+)/);
const connectionString = mongoUrlMatch ? mongoUrlMatch[1].trim() : null;

if (!connectionString) {
  console.error('❌ MONGO_URL not found in .env file');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '028_add_stable_estimation_item_id_to_links_history.sql'),
      'utf8'
    );
    
    console.log('Running migration 028: Add stable_estimation_item_id to links history table...');
    await pool.query(migrationSQL);
    console.log('✅ Migration 028 completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
