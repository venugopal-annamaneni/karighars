const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration 020...');
    const sql = fs.readFileSync('/app/migrations/020_remove_deleted_at_columns.sql', 'utf8');
    await client.query(sql);
    console.log('✅ Migration 020 completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
