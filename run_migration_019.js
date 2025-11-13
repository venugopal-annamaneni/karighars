// Script to execute migration 019
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

    console.log('\n📋 Executing migration 019_add_versioning_to_pr_items.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/019_add_versioning_to_pr_items.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 019 completed successfully!');
    
    // Verify columns were added
    console.log('\n📋 Verifying schema changes...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'purchase_request_items'
      AND column_name IN ('stable_item_id', 'version', 'lifecycle_status')
      ORDER BY column_name;
    `);
    
    console.log('\n✓ Added columns to purchase_request_items:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Verify tables created
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('purchase_request_items_history', 'purchase_request_versions', 'purchase_request_estimation_links_history')
      ORDER BY table_name;
    `);
    
    console.log('\n✓ Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigration();
