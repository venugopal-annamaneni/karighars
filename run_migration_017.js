// Script to execute migration 017
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

    console.log('\n📋 Executing migration 017_add_pricing_columns_to_pr_items.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/017_add_pricing_columns_to_pr_items.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 017 completed successfully!');
    
    // Verify columns were added
    console.log('\n📋 Verifying columns...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'purchase_request_items'
      AND column_name IN ('subtotal', 'gst_percentage', 'gst_amount', 'amount_before_gst', 'item_total')
      ORDER BY column_name;
    `);
    
    console.log('\n✓ Added columns:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}(${row.numeric_precision},${row.numeric_scale})`);
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
