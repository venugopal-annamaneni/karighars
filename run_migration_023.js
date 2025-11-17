// Script to execute migration 023
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

    console.log('\n📋 Executing migration 023_create_estimation_items_history.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/023_create_estimation_items_history.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 023 completed successfully!');
    
    // Verify table was created
    console.log('\n📋 Verifying estimation_items_history table...');
    const verifyResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'estimation_items_history'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✓ estimation_items_history table created successfully');
    } else {
      console.log('\n⚠️  Warning: estimation_items_history table not found!');
    }

    // Verify indexes
    console.log('\n📋 Verifying indexes...');
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'estimation_items_history'
    `);
    
    console.log('\n✓ Indexes created:');
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });

    // Count columns
    console.log('\n📋 Verifying columns...');
    const columnResult = await client.query(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_name = 'estimation_items_history'
    `);
    
    console.log(`\n✓ Total columns: ${columnResult.rows[0].column_count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigration();
