import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = params.path ? params.path.join('/') : '';
  const { searchParams } = new URL(request.url);

  try {
    // Projects
    if (path === 'projects') {
      const result = await query(`
        SELECT p.*, c.name as customer_name, u.name as created_by_name
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `);
      return NextResponse.json({ projects: result.rows });
    }

    if (path.startsWith('projects/') && path.split('/').length === 2) {
      const projectId = path.split('/')[1];
      const result = await query(`
        SELECT p.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
               u.name as created_by_name
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = $1
      `, [projectId]);
      
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Get latest estimation
      const estResult = await query(`
        SELECT * FROM project_estimations
        WHERE project_id = $1
        ORDER BY version DESC
        LIMIT 1
      `, [projectId]);

      // Get payment summary
      const paymentsIn = await query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM customer_payments_in
        WHERE project_id = $1
      `, [projectId]);

      const paymentsOut = await query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments_out
        WHERE project_id = $1
      `, [projectId]);

      return NextResponse.json({
        project: result.rows[0],
        estimation: estResult.rows[0] || null,
        payments_received: parseFloat(paymentsIn.rows[0].total),
        payments_made: parseFloat(paymentsOut.rows[0].total),
      });
    }

    // Customers
    if (path === 'customers') {
      const result = await query(`
        SELECT * FROM customers
        ORDER BY created_at DESC
      `);
      return NextResponse.json({ customers: result.rows });
    }

    // Vendors
    if (path === 'vendors') {
      const result = await query(`
        SELECT * FROM vendors
        WHERE is_active = true
        ORDER BY name
      `);
      return NextResponse.json({ vendors: result.rows });
    }

    // Estimations for a project
    if (path.startsWith('estimations/project/')) {
      const projectId = path.split('/')[2];
      const result = await query(`
        SELECT e.*, u.name as created_by_name
        FROM project_estimations e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.project_id = $1
        ORDER BY e.version DESC
      `, [projectId]);
      return NextResponse.json({ estimations: result.rows });
    }

    // Estimation items
    if (path.startsWith('estimation-items/')) {
      const estimationId = path.split('/')[1];
      const result = await query(`
        SELECT * FROM estimation_items
        WHERE estimation_id = $1
        ORDER BY id
      `, [estimationId]);
      return NextResponse.json({ items: result.rows });
    }

    // Vendor BOQs
    if (path === 'vendor-boqs') {
      const projectId = searchParams.get('project_id');
      let queryText = `
        SELECT vb.*, v.name as vendor_name, p.name as project_name
        FROM vendor_boqs vb
        LEFT JOIN vendors v ON vb.vendor_id = v.id
        LEFT JOIN projects p ON vb.project_id = p.id
      `;
      const params = [];
      
      if (projectId) {
        queryText += ' WHERE vb.project_id = $1';
        params.push(projectId);
      }
      
      queryText += ' ORDER BY vb.created_at DESC';
      
      const result = await query(queryText, params);
      return NextResponse.json({ boqs: result.rows });
    }

    // Purchase Orders
    if (path === 'purchase-orders') {
      const projectId = searchParams.get('project_id');
      let queryText = `
        SELECT po.*, v.name as vendor_name, p.name as project_name
        FROM purchase_orders po
        LEFT JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN projects p ON po.project_id = p.id
      `;
      const params = [];
      
      if (projectId) {
        queryText += ' WHERE po.project_id = $1';
        params.push(projectId);
      }
      
      queryText += ' ORDER BY po.created_at DESC';
      
      const result = await query(queryText, params);
      return NextResponse.json({ orders: result.rows });
    }

    // Customer Payments
    if (path === 'customer-payments') {
      const projectId = searchParams.get('project_id');
      let queryText = `
        SELECT cp.*, p.name as project_name, c.name as customer_name, u.name as created_by_name
        FROM customer_payments_in cp
        LEFT JOIN projects p ON cp.project_id = p.id
        LEFT JOIN customers c ON cp.customer_id = c.id
        LEFT JOIN users u ON cp.created_by = u.id
      `;
      const params = [];
      
      if (projectId) {
        queryText += ' WHERE cp.project_id = $1';
        params.push(projectId);
      }
      
      queryText += ' ORDER BY cp.payment_date DESC';
      
      const result = await query(queryText, params);
      return NextResponse.json({ payments: result.rows });
    }

    // Vendor Payments
    if (path === 'vendor-payments') {
      const projectId = searchParams.get('project_id');
      let queryText = `
        SELECT vp.*, v.name as vendor_name, p.name as project_name, u.name as created_by_name
        FROM payments_out vp
        LEFT JOIN vendors v ON vp.vendor_id = v.id
        LEFT JOIN projects p ON vp.project_id = p.id
        LEFT JOIN users u ON vp.created_by = u.id
      `;
      const params = [];
      
      if (projectId) {
        queryText += ' WHERE vp.project_id = $1';
        params.push(projectId);
      }
      
      queryText += ' ORDER BY vp.payment_date DESC';
      
      const result = await query(queryText, params);
      return NextResponse.json({ payments: result.rows });
    }

    // Dashboard stats
    if (path === 'dashboard/stats') {
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
          (SELECT COALESCE(SUM(total_value), 0) FROM project_estimations WHERE status = 'finalized') as total_project_value,
          (SELECT COALESCE(SUM(amount), 0) FROM customer_payments_in) as total_received,
          (SELECT COALESCE(SUM(amount), 0) FROM payments_out) as total_paid
      `);
      return NextResponse.json({ stats: stats.rows[0] });
    }

    // Recent activities
    if (path === 'dashboard/activities') {
      const activities = await query(`
        SELECT * FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 20
      `);
      return NextResponse.json({ activities: activities.rows });
    }

    // Users
    if (path === 'users') {
      const result = await query(`
        SELECT id, name, email, role, active, created_at
        FROM users
        ORDER BY name
      `);
      return NextResponse.json({ users: result.rows });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = params.path ? params.path.join('/') : '';
  const body = await request.json();

  try {
    // Create Customer
    if (path === 'customers') {
      const result = await query(
        `INSERT INTO customers (name, contact_person, phone, email, address, gst_number)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [body.name, body.contact_person, body.phone, body.email, body.address, body.gst_number]
      );
      return NextResponse.json({ customer: result.rows[0] });
    }

    // Create Project
    if (path === 'projects') {
      const projectCode = `PRJ-${Date.now()}`;
      const result = await query(
        `INSERT INTO projects (project_code, customer_id, name, location, phase, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [projectCode, body.customer_id, body.name, body.location, body.phase || 'onboarding', session.user.id]
      );

      // Log activity
      await query(
        `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [result.rows[0].id, 'projects', session.user.id, 'created', `Project created: ${body.name}`]
      );

      return NextResponse.json({ project: result.rows[0] });
    }

    // Create Estimation
    if (path === 'estimations') {
      // Get next version number
      const versionResult = await query(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM project_estimations WHERE project_id = $1',
        [body.project_id]
      );
      const nextVersion = versionResult.rows[0].next_version;

      const result = await query(
        `INSERT INTO project_estimations (project_id, version, total_value, woodwork_value, misc_internal_value, misc_external_value, remarks, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [body.project_id, nextVersion, body.total_value || 0, body.woodwork_value || 0, 
         body.misc_internal_value || 0, body.misc_external_value || 0, body.remarks, 
         body.status || 'draft', session.user.id]
      );

      // Add estimation items if provided
      if (body.items && body.items.length > 0) {
        for (const item of body.items) {
          await query(
            `INSERT INTO estimation_items (estimation_id, category, description, quantity, unit, unit_price, vendor_type, estimated_cost, estimated_margin)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [result.rows[0].id, item.category, item.description, item.quantity, item.unit, 
             item.unit_price, item.vendor_type, item.estimated_cost, item.estimated_margin]
          );
        }
      }

      return NextResponse.json({ estimation: result.rows[0] });
    }

    // Create Vendor
    if (path === 'vendors') {
      const result = await query(
        `INSERT INTO vendors (name, vendor_type, contact_person, phone, email, gst_number, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [body.name, body.vendor_type, body.contact_person, body.phone, body.email, body.gst_number, body.address]
      );
      return NextResponse.json({ vendor: result.rows[0] });
    }

    // Create Vendor BOQ
    if (path === 'vendor-boqs') {
      const boqCode = `BOQ-${Date.now()}`;
      const result = await query(
        `INSERT INTO vendor_boqs (project_id, vendor_id, boq_code, total_value, margin_percentage, status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [body.project_id, body.vendor_id, boqCode, body.total_value, body.margin_percentage, 
         body.status || 'draft', body.remarks]
      );

      // Add BOQ items if provided
      if (body.items && body.items.length > 0) {
        for (const item of body.items) {
          await query(
            `INSERT INTO vendor_boq_items (boq_id, estimation_item_id, description, quantity, unit, vendor_rate)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [result.rows[0].id, item.estimation_item_id, item.description, item.quantity, item.unit, item.vendor_rate]
          );
        }
      }

      return NextResponse.json({ boq: result.rows[0] });
    }

    // Create Purchase Order
    if (path === 'purchase-orders') {
      const poNumber = `PO-${Date.now()}`;
      const result = await query(
        `INSERT INTO purchase_orders (project_id, vendor_id, vendor_boq_id, po_number, issue_date, status, total_value, remarks, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [body.project_id, body.vendor_id, body.vendor_boq_id, poNumber, body.issue_date || new Date(), 
         body.status || 'draft', body.total_value, body.remarks, session.user.id]
      );
      return NextResponse.json({ order: result.rows[0] });
    }

    // Create Customer Payment
    if (path === 'customer-payments') {
      const result = await query(
        `INSERT INTO customer_payments_in (project_id, estimation_id, customer_id, payment_type, amount, payment_date, mode, reference_number, remarks, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [body.project_id, body.estimation_id, body.customer_id, body.payment_type, body.amount, 
         body.payment_date || new Date(), body.mode || 'bank', body.reference_number, body.remarks, session.user.id]
      );

      // Create ledger entry
      await query(
        `INSERT INTO project_ledger (project_id, source_table, source_id, entry_type, amount, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [body.project_id, 'customer_payments_in', result.rows[0].id, 'credit', body.amount, body.remarks]
      );

      // Log activity
      await query(
        `INSERT INTO activity_logs (project_id, related_entity, related_id, actor_id, action, comment)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [body.project_id, 'customer_payments_in', result.rows[0].id, session.user.id, 'payment_received', 
         `Payment received: ₹${body.amount}`]
      );

      return NextResponse.json({ payment: result.rows[0] });
    }

    // Create Vendor Payment
    if (path === 'vendor-payments') {
      const result = await query(
        `INSERT INTO payments_out (project_id, vendor_id, vendor_boq_id, payment_stage, amount, payment_date, mode, reference_number, remarks, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [body.project_id, body.vendor_id, body.vendor_boq_id, body.payment_stage, body.amount, 
         body.payment_date || new Date(), body.mode, body.reference_number, body.remarks, session.user.id]
      );

      // Create ledger entry
      await query(
        `INSERT INTO project_ledger (project_id, source_table, source_id, entry_type, amount, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [body.project_id, 'payments_out', result.rows[0].id, 'debit', body.amount, body.remarks]
      );

      return NextResponse.json({ payment: result.rows[0] });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = params.path ? params.path.join('/') : '';
  const body = await request.json();

  try {
    // Update Project
    if (path.startsWith('projects/')) {
      const projectId = path.split('/')[1];
      const updates = [];
      const values = [];
      let paramCounter = 1;

      if (body.name) {
        updates.push(`name = $${paramCounter++}`);
        values.push(body.name);
      }
      if (body.location) {
        updates.push(`location = $${paramCounter++}`);
        values.push(body.location);
      }
      if (body.phase) {
        updates.push(`phase = $${paramCounter++}`);
        values.push(body.phase);
      }
      if (body.status) {
        updates.push(`status = $${paramCounter++}`);
        values.push(body.status);
      }

      values.push(projectId);
      
      const result = await query(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`,
        values
      );

      // Log status change
      if (body.phase) {
        await query(
          `INSERT INTO project_status_history (project_id, new_status, changed_by, remarks)
           VALUES ($1, $2, $3, $4)`,
          [projectId, body.phase, session.user.id, body.remarks || '']
        );
      }

      return NextResponse.json({ project: result.rows[0] });
    }

    // Update Estimation
    if (path.startsWith('estimations/')) {
      const estimationId = path.split('/')[1];
      const result = await query(
        `UPDATE project_estimations 
         SET total_value = $1, woodwork_value = $2, misc_internal_value = $3, misc_external_value = $4, 
             status = $5, remarks = $6, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [body.total_value, body.woodwork_value, body.misc_internal_value, body.misc_external_value, 
         body.status, body.remarks, estimationId]
      );
      return NextResponse.json({ estimation: result.rows[0] });
    }

    // Update Vendor BOQ
    if (path.startsWith('vendor-boqs/')) {
      const boqId = path.split('/')[1];
      const result = await query(
        `UPDATE vendor_boqs 
         SET status = $1, total_value = $2, margin_percentage = $3, remarks = $4, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [body.status, body.total_value, body.margin_percentage, body.remarks, boqId]
      );

      // Log status change
      await query(
        `INSERT INTO vendor_boq_status_history (vendor_boq_id, new_status, changed_by, remarks)
         VALUES ($1, $2, $3, $4)`,
        [boqId, body.status, session.user.id, body.remarks || '']
      );

      return NextResponse.json({ boq: result.rows[0] });
    }

    // Update Purchase Order
    if (path.startsWith('purchase-orders/')) {
      const orderId = path.split('/')[1];
      const result = await query(
        `UPDATE purchase_orders 
         SET status = $1, remarks = $2
         WHERE id = $3 RETURNING *`,
        [body.status, body.remarks, orderId]
      );
      return NextResponse.json({ order: result.rows[0] });
    }

    // Update User Role
    if (path.startsWith('users/')) {
      const userId = path.split('/')[1];
      if (session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      const result = await query(
        `UPDATE users SET role = $1, active = $2 WHERE id = $3 RETURNING *`,
        [body.role, body.active !== undefined ? body.active : true, userId]
      );
      return NextResponse.json({ user: result.rows[0] });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = params.path ? params.path.join('/') : '';

  try {
    // Soft delete project
    if (path.startsWith('projects/')) {
      const projectId = path.split('/')[1];
      await query(
        `UPDATE projects SET status = 'archived' WHERE id = $1`,
        [projectId]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
