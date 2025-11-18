import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { PAYMENT_STATUS, ESTIMATION_ITEM_STATUS } from '@/app/constants';
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

      // 3. Create uploads directory if not exists
      const projectDir = path.join(process.cwd(), 'uploads', 'estimations', projectId.toString());
      if (!existsSync(projectDir)) {
        await mkdir(projectDir, { recursive: true });
      }

      // 4. Save CSV file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `estimation_${timestamp}.csv`;
      const filePath = path.join(projectDir, fileName);
      const relativeFilePath = `uploads/estimations/${projectId}/${fileName}`;

      await writeFile(filePath, csvContent);

      // 6. Process and calculate items
      const calculatedItems = [];
      for (const row of rows) {
        const itemData = {
          stable_item_id: row.stable_item_id?.trim() || null, // Parse stable_item_id from CSV
          category: row.category?.trim(),
          room_name: row.room_name?.trim(),
          item_name: row.item_name?.trim(),
          quantity: parseFloat(row.quantity) || 0,
          unit: row.unit?.toLowerCase().trim(),
          unit_price: parseFloat(row.unit_price) || 0,
          width: parseFloat(row.width) || null,
          height: parseFloat(row.height) || null,
          item_discount_percentage: parseFloat(row.item_discount_percentage) || 0,
          discount_kg_charges_percentage: parseFloat(row.discount_kg_charges_percentage) || 0,
          status: row.status?.trim() || ESTIMATION_ITEM_STATUS.QUEUED
        };
        const calculated = calculateItemTotal(itemData, baseRates);
        calculatedItems.push({ ...itemData, ...calculated });
      }      

      // 7. Calculate totals
      const totals = calculateCategoryTotals(calculatedItems, baseRates.category_rates.categories);
      
      // 8. Check for overpayment
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


      // 9. Check if estimation already exists
      const existingEstimation = await query(`
        SELECT id FROM project_estimations WHERE project_id = $1
      `, [projectId]);
      
      let estimationId;
      let isUpdate = false;
      let versionNumber = null;
      
      if (existingEstimation.rows.length > 0) {
        // ===== UPDATE PATH: Version existing estimation =====
        isUpdate = true;
        estimationId = existingEstimation.rows[0].id;
        
        console.log(`Updating existing estimation ${estimationId} via CSV upload`);
        
        // Get next version number
        const versionResult = await query(`
          SELECT COALESCE(MAX(version), 0) as max_version
          FROM estimation_items_history
          WHERE estimation_id = $1
        `, [estimationId]);
        
        versionNumber = versionResult.rows[0].max_version + 1;
        console.log(`Creating version ${versionNumber} for estimation ${estimationId}`);
        
        // Fetch old items to preserve audit fields
        const oldItemsResult = await query(`
          SELECT stable_item_id, created_at, created_by
          FROM estimation_items
          WHERE estimation_id = $1
        `, [estimationId]);
        
        const oldItemsMap = new Map();
        oldItemsResult.rows.forEach(item => {
          oldItemsMap.set(item.stable_item_id, {
            created_at: item.created_at,
            created_by: item.created_by
          });
        });
        
        console.log(`Archiving ${oldItemsResult.rows.length} items to history (version ${versionNumber})`);
        
        // Archive current items to history
        await query(`
          INSERT INTO estimation_items_history (
            id, stable_item_id, estimation_id,
            category, room_name, vendor_type, item_name,
            unit, width, height, quantity, unit_price,
            subtotal, karighar_charges_percentage, karighar_charges_amount,
            item_discount_percentage, item_discount_amount,
            discount_kg_charges_percentage, discount_kg_charges_amount,
            gst_percentage, gst_amount, amount_before_gst, item_total,
            status, created_at, created_by, updated_at, updated_by,
            version, archived_at, archived_by
          )
          SELECT 
            id, stable_item_id, estimation_id,
            category, room_name, vendor_type, item_name,
            unit, width, height, quantity, unit_price,
            subtotal, karighar_charges_percentage, karighar_charges_amount,
            item_discount_percentage, item_discount_amount,
            discount_kg_charges_percentage, discount_kg_charges_amount,
            gst_percentage, gst_amount, amount_before_gst, item_total,
            status, created_at, created_by, updated_at, updated_by,
            $2, NOW(), $3
          FROM estimation_items
          WHERE estimation_id = $1
        `, [estimationId, versionNumber, userId]);
        
        // Delete current items
        await query(`
          DELETE FROM estimation_items
          WHERE estimation_id = $1
        `, [estimationId]);
        
        console.log(`Items archived and deleted from estimation ${estimationId}`);
        
        // Insert new items from CSV
        for (const item of calculatedItems) {
          const stableItemId = item.stable_item_id || null;
          
          // Determine creation audit fields
          let createdAt, createdBy;
          
          if (stableItemId && oldItemsMap.has(stableItemId)) {
            // EXISTING ITEM: Preserve original created_at and created_by
            const oldAudit = oldItemsMap.get(stableItemId);
            createdAt = oldAudit.created_at;
            createdBy = oldAudit.created_by;
          } else {
            // NEW ITEM: Set created_by to current user, created_at to NOW
            createdAt = null;
            createdBy = userId;
          }
          
          await query(`
            INSERT INTO estimation_items (
              estimation_id, stable_item_id, category, room_name, item_name,
              unit, width, height, quantity, unit_price, subtotal, 
              karighar_charges_percentage, karighar_charges_amount,
              item_discount_percentage, item_discount_amount, 
              discount_kg_charges_percentage, discount_kg_charges_amount,
              gst_percentage, amount_before_gst, gst_amount, item_total,
              status, created_at, created_by, updated_at, updated_by
            ) VALUES ($1, COALESCE($2, gen_random_uuid()), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, COALESCE($23, NOW()), $24, NOW(), $25)
          `, [
            estimationId,
            stableItemId,
            item.category,
            item.room_name,
            item.item_name,
            item.unit,
            item.width,
            item.height,
            item.quantity,
            item.unit_price,
            item.subtotal,
            item.karighar_charges_percentage,
            item.karighar_charges_amount,
            item.item_discount_percentage,
            item.item_discount_amount,
            item.discount_kg_charges_percentage,
            item.discount_kg_charges_amount,
            item.gst_percentage,
            item.amount_before_gst,
            item.gst_amount,
            item.item_total,
            item.status,
            createdAt,
            createdBy,
            userId
          ]);
        }
        
        // Update estimation record with new totals
        await query(`
          UPDATE project_estimations
          SET 
            source = $2,
            csv_file_path = $3,
            category_breakdown = $4,
            items_value = $5,
            kg_charges = $6,
            items_discount = $7,
            kg_discount = $8,
            discount = $9,
            gst_amount = $10,
            final_value = $11,
            has_overpayment = $12,
            overpayment_amount = $13,
            updated_at = NOW(),
            updated_by = $14
          WHERE id = $1
        `, [
          estimationId,
          'csv_upload',
          relativeFilePath,
          JSON.stringify(totals.category_breakdown),
          totals.items_value,
          totals.kg_charges,
          totals.items_discount,
          totals.kg_discount,
          totals.discount,
          totals.gst_amount,
          totals.final_value,
          hasOverpayment,
          overpaymentAmount,
          userId
        ]);
        
        console.log(`Updated estimation ${estimationId} with new totals`);
        
      } else {
        // ===== CREATE PATH: New estimation =====
        console.log(`Creating new estimation via CSV upload`);
        
        const estimationRes = await query(`
          INSERT INTO project_estimations (
            project_id, source, csv_file_path, uploaded_by,
            category_breakdown, items_value, kg_charges, 
            items_discount, kg_discount, discount, gst_amount, final_value,
            created_by, has_overpayment, overpayment_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id
        `, [
          projectId,
          'csv_upload',
          relativeFilePath,
          userId,
          JSON.stringify(totals.category_breakdown),
          totals.items_value,
          totals.kg_charges,
          totals.items_discount,
          totals.kg_discount,
          totals.discount,
          totals.gst_amount,
          totals.final_value,
          userId,
          hasOverpayment,
          overpaymentAmount
        ]);

        estimationId = estimationRes.rows[0].id;

        // Insert new estimation items
        for (const item of calculatedItems) {
          await query(`
            INSERT INTO estimation_items (
              estimation_id, stable_item_id, category, room_name, item_name,
              unit, width, height, quantity, unit_price, subtotal, 
              karighar_charges_percentage, karighar_charges_amount,
              item_discount_percentage, item_discount_amount, 
              discount_kg_charges_percentage, discount_kg_charges_amount,
              gst_percentage, amount_before_gst, gst_amount, item_total,
              status, created_at, created_by, updated_at, updated_by
            ) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), $22, NOW(), $22)
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
            item.karighar_charges_percentage,
            item.karighar_charges_amount,
            item.item_discount_percentage,
            item.item_discount_amount,
            item.discount_kg_charges_percentage,
            item.discount_kg_charges_amount,
            item.gst_percentage,
            item.amount_before_gst,
            item.gst_amount,
            item.item_total,
            item.status,
            userId
          ]);
        }
      }

      // ===== COMMIT TRANSACTION =====
      await query('COMMIT');

      const response = {
        success: true,
        estimation_id: estimationId,
        items_count: calculatedItems.length,
        final_value: totals.final_value,
        file_name: fileName,
        is_update: isUpdate
      };
      
      if (isUpdate && versionNumber) {
        response.version = versionNumber;
        response.message = `Estimation updated successfully via CSV upload (version ${versionNumber})`;
      } else {
        response.message = 'Estimation created successfully via CSV upload';
      }

      return NextResponse.json(response);

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
