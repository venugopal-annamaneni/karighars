// Purchase Request Versioning Utilities
// Handles versioning by creating new PR records and moving old items to history

import { query } from '@/lib/db';

/**
 * Copy PR items to history tables and mark PR as inactive
 * Used before creating a new version of the PR
 * 
 * @param {number} prId - Purchase Request ID to archive
 * @returns {Promise<void>}
 */
export async function archivePRVersion(prId) {
  try {
    // Step 1: Copy items to history
    await query(`
      INSERT INTO purchase_request_items_history (
        stable_item_id,
        purchase_request_id,
        purchase_request_item_name,
        category,
        room_name,
        quantity,
        width,
        height,
        unit,
        unit_price,
        subtotal,
        gst_percentage,
        gst_amount,
        amount_before_gst,
        item_total,
        is_direct_purchase,
        lifecycle_status,
        status,
        active,
        created_by,
        created_at,
        updated_by,
        updated_at
      )
      SELECT 
        stable_item_id,
        purchase_request_id,
        purchase_request_item_name,
        category,
        room_name,
        quantity,
        width,
        height,
        unit,
        unit_price,
        subtotal,
        gst_percentage,
        gst_amount,
        amount_before_gst,
        item_total,
        is_direct_purchase,
        lifecycle_status,
        status,
        active,
        created_by,
        created_at,
        updated_by,
        updated_at
      FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);

    // Step 2: Copy estimation links to history
    await query(`
      INSERT INTO purchase_request_estimation_links_history (
        stable_estimation_item_id,
        stable_item_id,
        linked_qty,
        unit_purchase_request_item_weightage,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      SELECT 
        prel.stable_estimation_item_id,
        prel.stable_item_id,
        prel.linked_qty,
        prel.unit_purchase_request_item_weightage,
        prel.created_by,
        prel.updated_by,
        prel.created_at,
        prel.updated_at
      FROM purchase_request_estimation_links prel
      JOIN purchase_request_items pri ON prel.stable_item_id = pri.stable_item_id
      WHERE pri.purchase_request_id = $1
    `, [prId]);

    // Step 3: Delete links from main table
    await query(`
      DELETE FROM purchase_request_estimation_links
      WHERE stable_item_id IN (
        SELECT stable_item_id 
        FROM purchase_request_items 
        WHERE purchase_request_id = $1
      )
    `, [prId]);

    // Step 4: Delete items from main table
    await query(`
      DELETE FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);

    // Step 5: Mark PR as inactive
    await query(`
      UPDATE purchase_requests
      SET active = false, updated_at = NOW()
      WHERE id = $1
    `, [prId]);

  } catch (error) {
    console.error('Error archiving PR version:', error);
    throw new Error('Failed to archive PR version: ' + error.message);
  }
}

/**
 * Get all active draft PRs for a project grouped by vendor
 * Used to determine where to add items when vendor is selected
 * 
 * @param {number} projectId - Project ID
 * @returns {Promise<Object>} Map of vendor_id to PR data
 */
export async function getActiveDraftPRsByVendor(projectId) {
  try {
    const result = await query(`
      SELECT 
        pr.id,
        pr.pr_number,
        pr.vendor_id,
        v.name as vendor_name,
        pr.status,
        COUNT(pri.id) as items_count
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id AND pri.active = true
      WHERE pr.project_id = $1 
        AND pr.active = true 
        AND pr.status = 'draft'
      GROUP BY pr.id, pr.pr_number, pr.vendor_id, v.name, pr.status
      ORDER BY pr.vendor_id, pr.created_at DESC
    `, [projectId]);

    // Convert to map for easy lookup
    const vendorMap = {};
    result.rows.forEach(pr => {
      vendorMap[pr.vendor_id] = {
        id: pr.id,
        pr_number: pr.pr_number,
        vendor_id: pr.vendor_id,
        vendor_name: pr.vendor_name,
        items_count: parseInt(pr.items_count)
      };
    });

    return vendorMap;
  } catch (error) {
    console.error('Error getting draft PRs by vendor:', error);
    throw new Error('Failed to get draft PRs: ' + error.message);
  }
}

/**
 * Create a new PR record
 * 
 * @param {Object} prData - PR data
 * @param {number} prData.project_id
 * @param {number} prData.vendor_id
 * @param {number} prData.estimation_id
 * @param {string} prData.status - 'draft' or 'confirmed'
 * @param {string} prData.expected_delivery_date
 * @param {number} prData.created_by - User ID
 * @returns {Promise<Object>} Created PR with id and pr_number
 */
export async function createNewPR(prData) {
  try {
    // Get next PR number for this project
    const prNumberResult = await query(`
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(pr_number FROM 'PR-[0-9]+-([0-9]+)') AS INTEGER)
      ), 0) + 1 as next_number
      FROM purchase_requests
      WHERE project_id = $1
    `, [prData.project_id]);

    const nextNumber = prNumberResult.rows[0].next_number;
    const prNumber = `PR-${prData.project_id}-${String(nextNumber).padStart(3, '0')}`;

    // Create PR
    const result = await query(`
      INSERT INTO purchase_requests (
        project_id,
        vendor_id,
        estimation_id,
        pr_number,
        status,
        expected_delivery_date,
        items_value,
        gst_amount,
        final_value,
        active,
        created_at,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, true, NOW(), $7)
      RETURNING id, pr_number
    `, [
      prData.project_id,
      prData.vendor_id,
      prData.estimation_id,
      prNumber,
      prData.status || 'draft',
      prData.expected_delivery_date || null,
      prData.created_by
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating new PR:', error);
    throw new Error('Failed to create PR: ' + error.message);
  }
}

/**
 * Update PR totals after items are added/modified
 * 
 * @param {number} prId - Purchase Request ID
 * @returns {Promise<void>}
 */
export async function updatePRTotals(prId) {
  try {
    await query(`
      UPDATE purchase_requests pr
      SET 
        items_value = COALESCE(totals.subtotal, 0),
        gst_amount = COALESCE(totals.gst_amount, 0),
        final_value = COALESCE(totals.item_total, 0),
        updated_at = NOW()
      FROM (
        SELECT 
          SUM(subtotal) as subtotal,
          SUM(gst_amount) as gst_amount,
          SUM(item_total) as item_total
        FROM purchase_request_items
        WHERE purchase_request_id = $1 AND active = true
      ) as totals
      WHERE pr.id = $1
    `, [prId]);
  } catch (error) {
    console.error('Error updating PR totals:', error);
    throw new Error('Failed to update PR totals: ' + error.message);
  }
}
