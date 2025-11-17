// Script to execute migration 025
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

    console.log('\n📋 Executing migration 025_refactor_project_estimations.sql...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/025_refactor_project_estimations.sql'), 
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✓ Migration 025 completed successfully!');
    
    // Verify columns were removed
    console.log('\n📋 Verifying removed columns...');
    const removedResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'project_estimations'
      AND column_name IN ('version', 'is_active')
    `);
    
    if (removedResult.rows.length === 0) {
      console.log('✓ version and is_active columns removed');
    } else {
      console.log('⚠️  Warning: Some columns still exist:', removedResult.rows);
    }

    // Verify new columns were added
    console.log('\n📋 Verifying new columns...');
    const newResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'project_estimations'
      AND column_name IN ('updated_at', 'updated_by')
      ORDER BY column_name
    `);
    
    if (newResult.rows.length === 2) {
      console.log('✓ New columns added:');
      newResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    }

    // Verify unique constraint
    console.log('\n📋 Verifying unique constraint...');
    const constraintResult = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'project_estimations'
      AND constraint_name = 'uq_project_estimations_project_id'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✓ Unique constraint on project_id created');
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
