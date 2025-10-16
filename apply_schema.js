const { query } = require('./lib/db');
const fs = require('fs');

async function applySchema() {
  try {
    const sql = fs.readFileSync('./alter_kyc_gst_schema.sql', 'utf8');
    console.log('Applying schema updates...');
    await query(sql);
    console.log('✅ Schema updates applied successfully!');
  } catch (error) {
    console.error('❌ Error applying schema:', error.message);
    process.exit(1);
  }
  process.exit(0);
}

applySchema();
