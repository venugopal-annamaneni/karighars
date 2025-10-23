const { Pool } = require('pg');
const fs = require('fs');

async function extractSchema() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:Karighars%242025!!@database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com:5432/kg_interiors_finance?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Extracting database schema...');
    
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    let schema = `-- KG Interiors Finance Management System - Database Schema
-- Generated: ${new Date().toISOString()}
-- PostgreSQL 15+

-- Drop existing tables if needed (for clean installation)
-- Uncomment the following lines if you want to recreate the entire database

`;

    // Add DROP statements
    for (const row of tablesResult.rows) {
      schema += `-- DROP TABLE IF EXISTS ${row.table_name} CASCADE;\n`;
    }
    
    schema += '\n-- ============================================\n';
    schema += '-- TABLES\n';
    schema += '-- ============================================\n\n';

    // Get CREATE TABLE statements for each table
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      console.log(`Processing table: ${tableName}`);
      
      // Get columns
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);
      
      schema += `CREATE TABLE ${tableName} (\n`;
      
      const columnDefs = [];
      for (const col of columnsResult.rows) {
        let colDef = `    ${col.column_name} `;
        
        // Data type
        if (col.data_type === 'character varying') {
          colDef += col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'TEXT';
        } else if (col.data_type === 'timestamp with time zone') {
          colDef += 'TIMESTAMPTZ';
        } else if (col.data_type === 'timestamp without time zone') {
          colDef += 'TIMESTAMP';
        } else if (col.data_type === 'numeric') {
          if (col.numeric_precision && col.numeric_scale) {
            colDef += `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
          } else {
            colDef += 'NUMERIC';
          }
        } else if (col.data_type === 'integer') {
          colDef += 'INTEGER';
        } else if (col.data_type === 'bigint') {
          colDef += 'BIGINT';
        } else if (col.data_type === 'boolean') {
          colDef += 'BOOLEAN';
        } else {
          colDef += col.data_type.toUpperCase();
        }
        
        // Nullable
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        // Default
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        
        columnDefs.push(colDef);
      }
      
      // Get constraints
      const constraintsResult = await pool.query(`
        SELECT 
          conname,
          contype,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
        ORDER BY contype DESC;
      `, [tableName]);
      
      for (const constraint of constraintsResult.rows) {
        if (constraint.contype === 'p') {
          const match = constraint.definition.match(/PRIMARY KEY \((.*?)\)/);
          if (match) {
            columnDefs.push(`    PRIMARY KEY (${match[1]})`);
          }
        } else if (constraint.contype === 'f') {
          columnDefs.push(`    ${constraint.definition}`);
        } else if (constraint.contype === 'u') {
          columnDefs.push(`    ${constraint.definition}`);
        } else if (constraint.contype === 'c') {
          columnDefs.push(`    ${constraint.definition}`);
        }
      }
      
      schema += columnDefs.join(',\n');
      schema += '\n);\n\n';
      
      // Get comments
      const commentsResult = await pool.query(`
        SELECT 
          column_name,
          col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) as comment
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = $1
          AND col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) IS NOT NULL;
      `, [tableName]);
      
      for (const comment of commentsResult.rows) {
        schema += `COMMENT ON COLUMN ${tableName}.${comment.column_name} IS '${comment.comment}';\n`;
      }
      
      if (commentsResult.rows.length > 0) {
        schema += '\n';
      }
    }
    
    // Get indexes
    schema += '-- ============================================\n';
    schema += '-- INDEXES\n';
    schema += '-- ============================================\n\n';
    
    const indexesResult = await pool.query(`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);
    
    for (const idx of indexesResult.rows) {
      schema += `${idx.indexdef};\n`;
    }
    
    // Save to file
    fs.writeFileSync('/app/schema.sql', schema);
    console.log('\n✅ Schema exported to schema.sql');
    console.log(`Total tables: ${tablesResult.rows.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

extractSchema();
