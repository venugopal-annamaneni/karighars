import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { USER_ROLE } from '@/app/constants';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is Admin
  if (session.user.role !== USER_ROLE.ADMIN) {
    return NextResponse.json(
      { error: 'Only admins can approve base rate requests' },
      { status: 403 }
    );
  }

  const { id: projectId, baseRateId } = params;
  const body = await request.json();

  try {
    // Verify base_rate exists, is for this project, and is in requested status
    const baseRateCheck = await query(
      `SELECT * FROM project_base_rates 
       WHERE id = $1 AND project_id = $2 AND status = 'requested'`,
      [baseRateId, projectId]
    );

    if (baseRateCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Base rate request not found or not in pending status' },
        { status: 404 }
      );
    }

    const requestedRate = baseRateCheck.rows[0];

    // Deep check: Verify UI values match latest DB values for category_rates
    if (body.category_rates && body.category_rates.categories) {
      const bodyCategories = body.category_rates.categories;
      const dbCategories = requestedRate.category_rates.categories;

      // Check if number of categories match
      if (bodyCategories.length !== dbCategories.length) {
        return NextResponse.json(
          { error: 'Category structure has been modified. Please refresh and review.' },
          { status: 409 }
        );
      }

      // Deep check each category
      for (let i = 0; i < bodyCategories.length; i++) {
        const bodyCategory = bodyCategories[i];
        const dbCategory = dbCategories.find(c => c.id === bodyCategory.id);

        if (!dbCategory) {
          return NextResponse.json(
            { 
              error: 'Category mismatch detected. Please refresh.',
              category: bodyCategory.id
            },
            { status: 409 }
          );
        }

        // Check each field
        const fieldsToCheck = [
          'kg_percentage',
          'max_kg_discount_percentage',
          'max_item_discount_percentage'
        ];

        for (const field of fieldsToCheck) {
          if (bodyCategory[field] !== undefined && 
              parseFloat(bodyCategory[field]) !== parseFloat(dbCategory[field])) {
            return NextResponse.json(
              { 
                error: 'Base rate values have been modified. Please refresh and review before approving.',
                category: dbCategory.category_name,
                field: field,
                expectedValue: dbCategory[field],
                receivedValue: bodyCategory[field]
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Check GST percentage
    if (body.gst_percentage !== undefined && 
        parseFloat(body.gst_percentage) !== parseFloat(requestedRate.gst_percentage)) {
      return NextResponse.json(
        { 
          error: 'GST percentage has been modified. Please refresh.',
          field: 'gst_percentage',
          expectedValue: requestedRate.gst_percentage,
          receivedValue: body.gst_percentage
        },
        { status: 409 }
      );
    }

    // All checks passed, proceed with approval in a transaction
    await query('BEGIN');

    try {
      // Step 1: Deactivate all base_rates for this project
      await query(
        'UPDATE project_base_rates SET active = false WHERE project_id = $1',
        [projectId]
      );

      // Step 2: Activate and approve this base_rate
      await query(
        `UPDATE project_base_rates SET
          status = 'approved',
          active = true,
          approved_by = $1,
          approved_at = now()
         WHERE id = $2`,
        [session.user.id, baseRateId]
      );

      // Step 3: Update project.base_rate_id
      await query(
        'UPDATE projects SET base_rate_id = $1 WHERE id = $2',
        [baseRateId, projectId]
      );

      // Step 4: Log activity
      await query(
        `INSERT INTO activity_logs (project_id, related_entity, actor_id, action, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [projectId, 'project_base_rates', session.user.id, 'approved', 'Approved base rate change request']
      );

      await query('COMMIT');

      return NextResponse.json({
        message: 'Base rate request approved successfully'
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error approving base rate:', error);
    return NextResponse.json(
      { error: 'Failed to approve base rate request' },
      { status: 500 }
    );
  }
}
