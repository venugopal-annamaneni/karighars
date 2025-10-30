import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const version = parseInt(params.versionId);

  if (isNaN(version)) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }

  try {
    // Get estimation record to find CSV file path
    const estimationRes = await query(`
      SELECT id, version, csv_file_path, category_breakdown, 
             items_value, items_discount, kg_charges, kg_charges_discount,
             gst_amount, final_value, source
      FROM project_estimations
      WHERE project_id = $1 AND version = $2
    `, [projectId, version]);

    if (estimationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const estimation = estimationRes.rows[0];
    let csvFilePath = estimation.csv_file_path;

    if (!csvFilePath) {
      return NextResponse.json({ 
        error: 'No CSV file available for this version',
        message: 'This version was created manually and has no CSV file' 
      }, { status: 404 });
    }

    // Try to find the CSV file (upload or export)
    const fullPath = path.join(process.cwd(), csvFilePath);
    
    if (!existsSync(fullPath)) {
      // Try export CSV
      const exportPath = csvFilePath.replace('_upload.csv', '_export.csv');
      const fullExportPath = path.join(process.cwd(), exportPath);
      
      if (existsSync(fullExportPath)) {
        csvFilePath = exportPath;
      } else {
        return NextResponse.json({ 
          error: 'CSV file not found',
          message: 'The CSV file for this version is missing' 
        }, { status: 404 });
      }
    }

    // Read and parse CSV
    const csvContent = await readFile(path.join(process.cwd(), csvFilePath), 'utf-8');
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim()
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ 
        error: 'CSV parsing error', 
        errors: parseResult.errors 
      }, { status: 500 });
    }

    const items = parseResult.data.map((row, index) => ({
      id: `csv_${index}`,
      category: row.category?.trim(),
      room_name: row.room_name?.trim(),
      item_name: row.item_name?.trim(),
      quantity: parseFloat(row.quantity) || 0,
      unit: row.unit?.toLowerCase().trim(),
      rate: parseFloat(row.rate) || 0,
      width: parseFloat(row.width) || null,
      height: parseFloat(row.height) || null,
      item_discount_percentage: parseFloat(row.item_discount_percentage) || 0,
      discount_kg_charges_percentage: parseFloat(row.discount_kg_charges_percentage) || 0,
      // Include calculated fields if present in CSV
      subtotal: parseFloat(row.subtotal) || 0,
      karighar_charges_amount: parseFloat(row.karighar_charges_amount) || 0,
      item_discount_amount: parseFloat(row.item_discount_amount) || 0,
      discount_kg_charges_amount: parseFloat(row.discount_kg_charges_amount) || 0,
      amount_before_gst: parseFloat(row.amount_before_gst) || 0,
      gst_amount: parseFloat(row.gst_amount) || 0,
      item_total: parseFloat(row.item_total) || 0
    }));

    return NextResponse.json({
      source: 'csv',
      version: version,
      csv_file_path: csvFilePath,
      items: items,
      items_count: items.length,
      totals: {
        category_breakdown: estimation.category_breakdown,
        items_value: parseFloat(estimation.items_value) || 0,
        items_discount: parseFloat(estimation.items_discount) || 0,
        kg_charges: parseFloat(estimation.kg_charges) || 0,
        kg_charges_discount: parseFloat(estimation.kg_charges_discount) || 0,
        gst_amount: parseFloat(estimation.gst_amount) || 0,
        final_value: parseFloat(estimation.final_value) || 0
      }
    });

  } catch (error) {
    console.error('CSV loading error:', error);
    return NextResponse.json({ 
      error: 'Failed to load CSV', 
      message: error.message 
    }, { status: 500 });
  }
}
