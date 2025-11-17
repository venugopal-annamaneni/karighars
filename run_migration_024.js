// Script to execute migration 024
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

    console.log('\n📋 Executing migration 024_add_audit_columns_to_estimation_items.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/024_add_audit_columns_to_estimation_items.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 024 completed successfully!');
    
    // Verify columns were added
    console.log('\n📋 Verifying audit columns...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'estimation_items'
      AND column_name IN ('created_at', 'created_by', 'updated_at', 'updated_by')
      ORDER BY column_name
    `);
    
    if (verifyResult.rows.length === 4) {
      console.log('\n✓ All audit columns added to estimation_items:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}`);
      });
    } else {
      console.log('\n⚠️  Warning: Some audit columns missing!');
    }

    // Verify constraints
    console.log('\n📋 Verifying foreign key constraints...');
    const fkResult = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'estimation_items'
      AND constraint_name LIKE 'fk_estimation_items_%'
    `);
    
    console.log('\n✓ Foreign key constraints:');
    fkResult.rows.forEach(row => {
      console.log(`  - ${row.constraint_name}`);
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
