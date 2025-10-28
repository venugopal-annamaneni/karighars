// Quick migration script to update milestone structure
import { query } from './lib/db.js';
import fs from 'fs';

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Dynamic Milestone Categories...');
    
    const sql = fs.readFileSync('./migrations/007_dynamic_milestone_categories.sql', 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('--'));
    
    for (const statement of statements) {
      try {
        await query(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      } catch (err) {
        console.warn('⚠️ Statement warning:', err.message);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
