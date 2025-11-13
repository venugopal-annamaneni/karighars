// Script to execute migration 016
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeMigration() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    console.log('\n📋 Executing migration 016_add_unit_price_to_pr_items.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/016_add_unit_price_to_pr_items.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 016 completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigration();
