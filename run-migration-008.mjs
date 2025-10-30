import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manually load .env file
const envPath = join(__dirname, '.env');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...values] = trimmed.split('=');
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join('=').trim();
    }
  }
});

async function runMigration() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded' : 'NOT FOUND');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com') ? {
      rejectUnauthorized: false
    } : undefined
  });
  
  try {
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
    
    const sqlPath = join(__dirname, 'migrations', '008_csv_upload_support.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    console.log('Applying migration 008_csv_upload_support.sql...');
    
    await pool.query(sql);
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
