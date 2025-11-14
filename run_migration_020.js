// Script to execute migration 020
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

    console.log('\n📋 Executing migration 020_remove_deleted_at_columns.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/020_remove_deleted_at_columns.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 020 completed successfully!');
    
    // Verify columns were removed
    console.log('\n📋 Verifying columns were removed...');
    const verifyResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name IN ('purchase_request_items', 'purchase_request_items_history')
      AND column_name IN ('deleted_at', 'deleted_by')
      ORDER BY table_name, column_name;
    `);
    
    if (verifyResult.rows.length === 0) {
      console.log('\n✓ All deleted_at and deleted_by columns successfully removed!');
    } else {
      console.log('\n⚠️  Warning: Some columns still exist:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigration();
