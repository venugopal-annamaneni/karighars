const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to database...');
    
    // Add category_rates column
    console.log('Step 1: Adding category_rates column...');
    await client.query(`
      ALTER TABLE biz_models 
      ADD COLUMN IF NOT EXISTS category_rates JSONB DEFAULT '{"categories": []}'::jsonb
    `);
    console.log('✓ Column added');

    // Migrate existing data
    console.log('Step 2: Migrating existing data...');
    await client.query(`
      UPDATE biz_models
      SET category_rates = jsonb_build_object(
        'categories', jsonb_build_array(
          jsonb_build_object(
            'id', 'woodwork',
            'category_name', 'Woodwork',
            'kg_label', 'Design and Consultation',
            'max_item_discount_percentage', 20,
            'kg_percentage', COALESCE(design_charge_percentage, 10),
            'max_kg_discount_percentage', COALESCE(max_design_charge_discount_percentage, 50)
          ),
          jsonb_build_object(
            'id', 'misc',
            'category_name', 'Misc',
            'kg_label', 'Service Charges',
            'max_item_discount_percentage', 20,
            'kg_percentage', COALESCE(service_charge_percentage, 8),
            'max_kg_discount_percentage', COALESCE(max_service_charge_discount_percentage, 40)
          ),
          jsonb_build_object(
            'id', 'shopping',
            'category_name', 'Shopping',
            'kg_label', 'Shopping Service Charges',
            'max_item_discount_percentage', 20,
            'kg_percentage', COALESCE(shopping_charge_percentage, 5),
            'max_kg_discount_percentage', COALESCE(max_shopping_charge_discount_percentage, 30)
          )
        )
      )
      WHERE category_rates = '{"categories": []}'::jsonb OR category_rates IS NULL
    `);
    console.log('✓ Data migrated');

    // Verify migration
    console.log('Step 3: Verifying migration...');
    const result = await client.query('SELECT id, code, name, category_rates FROM biz_models LIMIT 2');
    console.log('Sample data:', JSON.stringify(result.rows, null, 2));
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
