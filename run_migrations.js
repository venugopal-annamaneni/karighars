// Script to execute database migrations
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeMigrations() {
  // Set environment variable to ignore SSL certificate validation
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

    // Step 1: Truncate project data
    console.log('\n📋 Step 1: Truncating project data (preserving biz_models and customers)...');
    const truncateSQL = fs.readFileSync(path.join(__dirname, 'truncate_project_data.sql'), 'utf8');
    await client.query(truncateSQL);
    console.log('✓ Data truncation completed');

    // Step 2: Add room and unit columns
    console.log('\n📋 Step 2: Adding room_name, unit, width, height columns...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'add_room_and_unit_columns.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('✓ Schema migration completed');

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigrations();
