// Script to execute migration 022
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

    console.log('\n📋 Executing migration 022_add_stable_estimation_item_id_to_links.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/022_add_stable_estimation_item_id_to_links.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 022 completed successfully!');
    
    // Verify column was added
    console.log('\n📋 Verifying stable_estimation_item_id column...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'purchase_request_estimation_links'
      AND column_name = 'stable_estimation_item_id'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✓ stable_estimation_item_id column added to purchase_request_estimation_links:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}`);
      });
    } else {
      console.log('\n⚠️  Warning: stable_estimation_item_id column not found!');
    }

    // Verify foreign key constraint
    console.log('\n📋 Verifying foreign key constraint...');
    const fkResult = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'purchase_request_estimation_links'
      AND constraint_name = 'fk_stable_estimation_item_id'
    `);
    
    if (fkResult.rows.length > 0) {
      console.log('\n✓ Foreign key constraint created:');
      fkResult.rows.forEach(row => {
        console.log(`  - ${row.constraint_name}: ${row.constraint_type}`);
      });
    }

    // Verify indexes
    console.log('\n📋 Verifying indexes...');
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'purchase_request_estimation_links'
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
