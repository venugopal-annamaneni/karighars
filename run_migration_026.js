// Script to execute migration 026
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

    console.log('\n📋 Executing migration 026_add_version_to_estimation_items_history.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/026_add_version_to_estimation_items_history.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 026 completed successfully!');
    
    // Verify column was added
    console.log('\n📋 Verifying version column...');
    const columnResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'estimation_items_history'
      AND column_name = 'version'
    `);
    
    if (columnResult.rows.length > 0) {
      console.log('✓ version column added:');
      columnResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}`);
      });
    }

    // Verify indexes
    console.log('\n📋 Verifying indexes...');
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'estimation_items_history'
      AND indexname LIKE '%version%'
    `);
    
    console.log('✓ Version-related indexes:');
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
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
