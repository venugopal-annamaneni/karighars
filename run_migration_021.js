// Script to execute migration 021
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

    console.log('\n📋 Executing migration 021_add_stable_item_id_to_estimation_items.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/021_add_stable_item_id_to_estimation_items.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 021 completed successfully!');
    
    // Verify column was added
    console.log('\n📋 Verifying stable_item_id column...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'estimation_items'
      AND column_name = 'stable_item_id'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✓ stable_item_id column added to estimation_items:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}, default=${row.column_default}`);
      });
    } else {
      console.log('\n⚠️  Warning: stable_item_id column not found!');
    }

    // Verify indexes
    console.log('\n📋 Verifying indexes...');
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'estimation_items'
      AND indexname LIKE '%stable%'
    `);
    
    console.log('\n✓ Indexes created:');
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
