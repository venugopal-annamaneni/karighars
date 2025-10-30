import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { PAYMENT_STATUS } from '@/app/constants';
import { calculateItemTotal, calculateCategoryTotals } from '@/lib/calcUtils';

async function readUploadedFile(file) {
  if (typeof file.arrayBuffer === 'function') {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  const chunks = [];
  for await (const chunk of file.stream()) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const userId = session.user.id;

  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Read file content
    const buffer = await readUploadedFile(file);
    const csvContent = buffer.toString('utf-8');

    // Parse CSV
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim()
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'CSV parsing error',
        errors: parseResult.errors
      }, { status: 400 });
    }

    const rows = parseResult.data;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSV file is empty' }, { status: 400 });
    }

    // ===== BEGIN TRANSACTION =====
    await query('BEGIN');

    try {
      // 1. Check for existing lock
      const lockCheck = await query(`
        SELECT id, locked_by, locked_at 
        FROM project_estimations 
        WHERE project_id = $1 AND is_locked = true
      `, [projectId]);

      if (lockCheck.rows.length > 0) {
        await query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: 'Project is currently locked. Another user is uploading or editing.'
        }, { status: 409 });
      }

      // 2. Get project and base rates
      const projectRes = await query(`
        SELECT p.id, p.name, p.biz_model_id, pbr.category_rates, pbr.gst_percentage
        FROM projects p
        LEFT JOIN project_base_rates pbr ON p.id = pbr.project_id AND pbr.active = 'true'
        WHERE p.id = $1
      `, [projectId]);

      if (projectRes.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
      }

      const project = projectRes.rows[0];
      console.log(project);
      const baseRates = {
        category_rates: project.category_rates,
        gst_percentage: project.gst_percentage
      };

      if (!baseRates.category_rates || !baseRates.category_rates.categories) {
        await query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: 'Project base rates not configured'
        }, { status: 400 });
      }

      // 3. Get next version number
      const versionRes = await query(`
        SELECT COALESCE(MAX(version), 0) as max_version
        FROM project_estimations
        WHERE project_id = $1
      `, [projectId]);
      const nextVersion = versionRes.rows[0].max_version + 1;

      // 4. Create uploads directory if not exists
      const projectDir = path.join(process.cwd(), 'uploads', 'estimations', projectId.toString());
      if (!existsSync(projectDir)) {
        await mkdir(projectDir, { recursive: true });
      }

      // 5. Save CSV file
      const fileName = `v${nextVersion}_upload.csv`;
      const filePath = path.join(projectDir, fileName);
      const relativeFilePath = `uploads/estimations/${projectId}/${fileName}`;

      await writeFile(filePath, csvContent);

      // 6. Process and calculate items
      const calculatedItems = [];
      for (const row of rows) {
        const itemData = {
          category: row.category?.trim(),
          room_name: row.room_name?.trim(),
          item_name: row.item_name?.trim(),
          quantity: parseFloat(row.quantity) || 0,
          unit: row.unit?.toLowerCase().trim(),
          unit_price: parseFloat(row.unit_price) || 0,
          width: parseFloat(row.width) || null,
          height: parseFloat(row.height) || null,
          item_discount_percentage: parseFloat(row.item_discount_percentage) || 0,
          discount_kg_charges_percentage: parseFloat(row.discount_kg_charges_percentage) || 0
        };

        const calculated = calculateItemTotal(itemData, baseRates);
        calculatedItems.push({ ...itemData, ...calculated });
      }

      // 7. Calculate totals
      const totals = calculateCategoryTotals(calculatedItems, baseRates.category_rates.categories);

      // 8. Mark all previous versions as inactive and unlock them
      await query(`
        UPDATE project_estimations
        SET is_active = false, is_locked = false, locked_by = NULL, locked_at = NULL
        WHERE project_id = $1 AND is_active = true
      `, [projectId]);

      // 8.1 Check for overpayment (only for revision, not first estimation)
      let hasOverpayment = false;
      let overpaymentAmount = 0;


      // Get total approved payments
      const paymentsRes = await query(`
            SELECT COALESCE(SUM(amount), 0) as total_collected
            FROM customer_payments
            WHERE project_id = $1 AND status = $2
          `, [projectId, PAYMENT_STATUS.APPROVED]);

      const totalCollected = parseFloat(paymentsRes.rows[0].total_collected || 0);

      if (totalCollected > totals.final_value) {
        hasOverpayment = true;
        overpaymentAmount = totalCollected - totals.final_value;
      }


      // 9. Create new project_estimations record (locked during creation)
      const estimationRes = await query(`
        INSERT INTO project_estimations (
          project_id, version, source, csv_file_path, uploaded_by,
          is_active, is_locked, locked_by, locked_at, status,
          category_breakdown, items_value, kg_charges, 
          item_discount, kg_discount, discount, gst_amount, final_value,
          created_at, updated_at, has_overpayment, overpayment_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,NOW(), $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), $18, $19)
        RETURNING id
      `, [
        projectId,
        nextVersion,
        'csv_upload',
        relativeFilePath,
        userId,
        true,          // is_active
        false,         // is_locked (unlock immediately after creation)
        null,          // locked_by
        'draft',
        JSON.stringify(totals.category_breakdown),
        totals.items_value,
        totals.kg_charges,
        totals.items_discount,
        totals.kg_charges_discount,
        totals.items_discount + totals.kg_charges_discount,
        totals.gst_amount,
        totals.final_value,
        hasOverpayment,
        overpaymentAmount
      ]);

      const estimationId = estimationRes.rows[0].id;

      // 10. Insert estimation items
      for (const item of calculatedItems) {
        await query(`
          INSERT INTO estimation_items (
            estimation_id, category, room_name, item_name,
            unit, width, height, quantity, unit_price, 
            subtotal, karighar_charges_percentage, karighar_charges_amount,
            item_discount_percentage, item_discount_amount, 
            discount_kg_charges_percentage, discount_kg_charges_amount,
            gst_percentage, amount_before_gst, gst_amount, item_total,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
        `, [
          estimationId,
          item.category,
          item.room_name,
          item.item_name,
          item.unit,
          item.width,
          item.height,
          item.quantity,
          item.unit_price,
          item.subtotal,
          item.discount_kg_charges_percentage,
          item.karighar_charges_amount,
          item.item_discount_percentage,
          item.item_discount_amount,
          baseRates.category_rates.categories.find(c => c.id === item.category)?.kg_percentage || 0,
          item.discount_kg_charges_amount,
          item.gst_percentage,
          item.amount_before_gst,
          item.gst_amount,
          item.item_total
        ]);
      }

      // ===== COMMIT TRANSACTION =====
      await query('COMMIT');

      return NextResponse.json({
        success: true,
        version: nextVersion,
        estimation_id: estimationId,
        items_count: calculatedItems.length,
        final_value: totals.final_value
      });

    } catch (error) {
      // ===== ROLLBACK ON ERROR =====
      await query('ROLLBACK');
      console.error('Transaction error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to process upload',
        message: error.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
      message: error.message
    }, { status: 500 });
  }
}
