// Run migration 027
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
