import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import Papa from 'papaparse';
import { ESTIMATION_ITEM_STATUS } from '@/app/constants';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // Get project's base rates to determine categories
    const projectRes = await query(`
      SELECT p.id, p.name, pbr.category_rates
      FROM projects p
      LEFT JOIN project_base_rates pbr ON p.id = pbr.project_id AND pbr.active = 'true'
      WHERE p.id = $1
    `, [projectId]);

    if (projectRes.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectRes.rows[0];
    const categoryRates = project.category_rates;

    if (!categoryRates || !categoryRates.categories) {
      return NextResponse.json({ 
        error: 'Project base rates not configured' 
      }, { status: 400 });
    }

    // Define CSV headers
    const headers = [
      'category',
      'room_name',
      'item_name',
      'quantity',
      'unit',
      'unit_price',
      'width',
      'height',
      'item_discount_percentage',
      'discount_kg_charges_percentage',
      'status'
    ];

    // Fetch actual estimation items from the project's active estimation
    const estimationItemsRes = await query(`
      SELECT 
        ei.category,
        ei.room_name,
        ei.item_name,
        ei.quantity,
        ei.unit,
        ei.unit_price,
        ei.width,
        ei.height,
        ei.item_discount_percentage,
        ei.discount_kg_charges_percentage,
        ei.status
      FROM estimation_items ei
      INNER JOIN project_estimations pe ON ei.estimation_id = pe.id
      WHERE pe.project_id = $1
      ORDER BY ei.category, ei.room_name, ei.item_name
    `, [projectId]);

    // Use actual items if available, otherwise create sample rows
    let dataRows;
    if (estimationItemsRes.rows.length > 0) {
      // Use actual estimation items
      dataRows = estimationItemsRes.rows.map(item => ({
        category: item.category,
        room_name: item.room_name,
        item_name: item.item_name,
        quantity: item.quantity || '',
        unit: item.unit || '',
        unit_price: item.unit_price || '',
        width: item.width || '',
        height: item.height || '',
        item_discount_percentage: item.item_discount_percentage || '0',
        discount_kg_charges_percentage: item.discount_kg_charges_percentage || '0',
        status: item.status || ESTIMATION_ITEM_STATUS.QUEUED
      }));
    } else {
      // Fallback to sample rows if no active estimation exists
      dataRows = categoryRates.categories
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(category => ({
          category: category.id,
          room_name: 'Sample Room',
          item_name: `Sample ${category.category_name} Item`,
          quantity: category.id === 'woodwork' ? '120' : '1',
          unit: category.id === 'woodwork' ? 'sqft' : 'no',
          unit_price: '1000',
          width: category.id === 'woodwork' ? '10' : '',
          height: category.id === 'woodwork' ? '12' : '',
          item_discount_percentage: '0',
          discount_kg_charges_percentage: '0',
          status: ESTIMATION_ITEM_STATUS.QUEUED
        }));
    }

    // Generate CSV
    const csv = Papa.unparse({
      fields: headers,
      data: dataRows
    });

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="estimation_template_project_${projectId}.csv"`
      }
    });

  } catch (error) {
    console.error('Template download error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate template', 
      message: error.message 
    }, { status: 500 });
  }
}
