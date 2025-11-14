// Versioning utilities for Purchase Requests
import { query } from '@/lib/db';
import { calculateItemPricing, calculatePRTotals } from '@/lib/pricing-utils';

/**
 * Create a new version for a PR by moving all current items to history
 * and re-inserting them with a new version number
 * 
 * @param {number} prId - Purchase request ID
 * @param {Array} updatedItems - Array of items with updates (must include stable_item_id and estimation_links)
 * @param {number} userId - User making the change
 * @param {string} changeSummary - Description of what changed
 * @returns {Promise<number>} New version number
 */
export async function createNewPRVersion(prId, updatedItems, userId, changeSummary) {
  try {
    // 1. Get current max version
    const versionResult = await query(`
      SELECT COALESCE(MAX(version), 0) as current_version
      FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);
    
    const currentVersion = versionResult.rows[0].current_version;
    const newVersion = currentVersion + 1;
    
    // 2. Get all current items with their links
    const currentItemsResult = await query(`
      SELECT 
        pri.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', prel.id,
              'estimation_item_id', prel.estimation_item_id,
              'linked_qty', prel.linked_qty,
              'weightage', prel.unit_purchase_request_item_weightage,
              'notes', prel.notes
            )
          ) FILTER (WHERE prel.id IS NOT NULL),
          '[]'
        ) as estimation_links
      FROM purchase_request_items pri
      LEFT JOIN purchase_request_estimation_links prel 
        ON pri.stable_item_id = prel.stable_item_id
      WHERE pri.purchase_request_id = $1
      GROUP BY pri.id, pri.stable_item_id, pri.purchase_request_id, pri.version,
        pri.purchase_request_item_name, pri.category, pri.room_name,
        pri.quantity, pri.unit, pri.width, pri.height,
        pri.unit_price, pri.subtotal, pri.gst_percentage, pri.gst_amount,
        pri.amount_before_gst, pri.item_total,
        pri.lifecycle_status, pri.is_direct_purchase, pri.status,
        pri.created_at, pri.created_by, pri.updated_at, pri.updated_by
    `, [prId]);
    
    const currentItems = currentItemsResult.rows;
    
    if (currentItems.length === 0) {
      throw new Error('No items found in purchase request');
    }
    
    // 3. Move ALL current items to history
    await query(`
      INSERT INTO purchase_request_items_history (
        id, stable_item_id, purchase_request_id, version,
        purchase_request_item_name, category, room_name,
        quantity, unit, width, height,
        unit_price, subtotal, gst_percentage, gst_amount,
        amount_before_gst, item_total,
        lifecycle_status, is_direct_purchase, status,
        created_at, created_by, updated_at, updated_by,
        deleted_at, deleted_by, archived_at, archived_by
      )
      SELECT 
        id, stable_item_id, purchase_request_id, version,
        purchase_request_item_name, category, room_name,
        quantity, unit, width, height,
        unit_price, subtotal, gst_percentage, gst_amount,
        amount_before_gst, item_total,
        lifecycle_status, is_direct_purchase, status,
        created_at, created_by, updated_at, updated_by,
        deleted_at, deleted_by, NOW(), $2
      FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId, userId]);
    
    // 4. Move ALL current links to history
    await moveLinksToHistory(prId, userId);
    
    // 5. Delete from current tables
    await query(`
      DELETE FROM purchase_request_estimation_links
      WHERE stable_item_id IN (
        SELECT stable_item_id FROM purchase_request_items
        WHERE purchase_request_id = $1
      )
    `, [prId]);
    
    await query(`
      DELETE FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);
    
    // 6. Create map of updated items by stable_item_id
    const updatesMap = new Map();
    updatedItems.forEach(item => {
      if (item.stable_item_id) {
        updatesMap.set(item.stable_item_id, item);
      }
    });
    
    // 7. Re-insert all items with new version and their links
    const itemsAffected = [];
    const newItemIdMap = new Map(); // Map stable_item_id to new purchase_request_item.id
    
    for (const item of currentItems) {
      // Check if this item has updates
      const updates = updatesMap.get(item.stable_item_id);
      const itemData = updates ? { ...item, ...updates } : item;
      
      // Track if this item was affected
      if (updates) {
        itemsAffected.push(item.stable_item_id);
      }
      
      // Recalculate pricing if price/quantity changed
      let pricing = {
        subtotal: itemData.subtotal,
        gst_percentage: itemData.gst_percentage,
        gst_amount: itemData.gst_amount,
        amount_before_gst: itemData.amount_before_gst,
        item_total: itemData.item_total
      };
      
      if (updates && (updates.unit_price !== undefined || updates.quantity !== undefined)) {
        pricing = calculateItemPricing(
          itemData.quantity,
          itemData.unit_price,
          itemData.gst_percentage || 0
        );
      }
      
      const insertResult = await query(`
        INSERT INTO purchase_request_items (
          stable_item_id, purchase_request_id, version,
          purchase_request_item_name, category, room_name,
          quantity, unit, width, height,
          unit_price, subtotal, gst_percentage, gst_amount,
          amount_before_gst, item_total,
          lifecycle_status, is_direct_purchase, status,
          created_at, created_by, updated_at, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), $22)
        RETURNING id
      `, [
        itemData.stable_item_id,
        prId,
        newVersion,
        itemData.purchase_request_item_name,
        itemData.category,
        itemData.room_name,
        itemData.quantity,
        itemData.unit,
        itemData.width,
        itemData.height,
        itemData.unit_price,
        pricing.subtotal,
        pricing.gst_percentage,
        pricing.gst_amount,
        pricing.amount_before_gst,
        pricing.item_total,
        itemData.lifecycle_status || 'pending',
        itemData.is_direct_purchase,
        itemData.status,
        itemData.created_at,
        itemData.created_by,
        userId
      ]);
      
      const newPurchaseRequestItemId = insertResult.rows[0].id;
      newItemIdMap.set(itemData.stable_item_id, newPurchaseRequestItemId);
      
      // 8. Re-insert estimation links for this item
      // Use updated links if provided, otherwise use current links
      let linksToInsert = [];
      
      if (updates && updates.estimation_links !== undefined) {
        // Use the updated links from the payload
        linksToInsert = updates.estimation_links || [];
      } else {
        // Use existing links from current item
        linksToInsert = typeof item.estimation_links === 'string' 
          ? JSON.parse(item.estimation_links) 
          : (item.estimation_links || []);
      }
      
      // Insert each link
      for (const link of linksToInsert) {
        if (link.estimation_item_id) {
          await query(`
            INSERT INTO purchase_request_estimation_links (
              stable_item_id,
              version,
              estimation_item_id,
              purchase_request_item_id,
              linked_qty,
              unit_purchase_request_item_weightage,
              notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            itemData.stable_item_id,
            newVersion,
            link.estimation_item_id,
            newPurchaseRequestItemId,
            link.linked_qty || 0,
            link.weightage || link.unit_purchase_request_item_weightage || 1.0,
            link.notes || null
          ]);
        }
      }
    }
    
    // 9. Update PR-level totals
    await recalculatePRTotals(prId);
    
    // 10. Create version record
    await query(`
      INSERT INTO purchase_request_versions (
        purchase_request_id, version, change_type,
        change_summary, items_affected, total_items,
        created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
    `, [
      prId,
      newVersion,
      itemsAffected.length > 0 ? 'items_edited' : 'items_added',
      changeSummary,
      itemsAffected,
      currentItems.length,
      userId
    ]);
    
    return newVersion;
    
  } catch (error) {
    console.error('Error creating new PR version:', error);
    throw error;
  }
}

/**
 * Version estimation links alongside PR items
 */
async function versionEstimationLinks(prId, newVersion, userId) {
  try {
    // Check if there are any links to version
    const linksResult = await query(`
      SELECT prel.*
      FROM purchase_request_estimation_links prel
      INNER JOIN purchase_request_items pri ON prel.stable_item_id = pri.stable_item_id
      WHERE pri.purchase_request_id = $1
    `, [prId]);
    
    if (linksResult.rows.length === 0) {
      return; // No links to version
    }
    
    // Move current links to history
    await query(`
      INSERT INTO purchase_request_estimation_links_history (
        id, stable_item_id, version, estimation_item_id,
        purchase_request_item_id, linked_qty,
        unit_purchase_request_item_weightage, notes,
        created_at, archived_at
      )
      SELECT 
        id, stable_item_id, version, estimation_item_id,
        purchase_request_item_id, linked_qty,
        unit_purchase_request_item_weightage, notes,
        created_at, NOW()
      FROM purchase_request_estimation_links prel
      WHERE stable_item_id IN (
        SELECT stable_item_id FROM purchase_request_items
        WHERE purchase_request_id = $1
      )
    `, [prId]);
    
    // Update version on current links
    await query(`
      UPDATE purchase_request_estimation_links
      SET version = $2
      WHERE stable_item_id IN (
        SELECT stable_item_id FROM purchase_request_items
        WHERE purchase_request_id = $1
      )
    `, [prId, newVersion]);
    
  } catch (error) {
    console.error('Error versioning estimation links:', error);
    throw error;
  }
}

/**
 * Recalculate PR-level totals from current items
 */
async function recalculatePRTotals(prId) {
  try {
    const itemsResult = await query(`
      SELECT subtotal, gst_amount, item_total
      FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);
    
    const prTotals = calculatePRTotals(itemsResult.rows);
    
    await query(`
      UPDATE purchase_requests
      SET 
        items_value = $1,
        gst_amount = $2,
        final_value = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [prTotals.items_value, prTotals.gst_amount, prTotals.final_value, prId]);
    
  } catch (error) {
    console.error('Error recalculating PR totals:', error);
    throw error;
  }
}

/**
 * Add new items to a PR (creates new version)
 */
export async function addItemsToPR(prId, newItems, gstPercentage, userId, mode = 'direct') {
  try {
    // Get current items to version
    const currentItemsResult = await query(`
      SELECT * FROM purchase_request_items
      WHERE purchase_request_id = $1
    `, [prId]);
    
    // Prepare new items with stable_item_id and pricing
    const itemsToAdd = newItems.map(item => {
      const pricing = calculateItemPricing(
        item.quantity,
        item.unit_price,
        gstPercentage
      );
      
      return {
        stable_item_id: null, // Will be generated by DB
        purchase_request_id: prId,
        purchase_request_item_name: item.name,
        category: item.category,
        room_name: item.room_name || null,
        quantity: item.quantity,
        unit: item.unit,
        width: item.width || null,
        height: item.height || null,
        unit_price: item.unit_price || null,
        ...pricing,
        lifecycle_status: 'pending',
        is_direct_purchase: mode === 'direct',
        status: 'draft',
        created_at: new Date(),
        created_by: userId
      };
    });
    
    // Current items stay as-is, new items get added
    const allItems = [...currentItemsResult.rows, ...itemsToAdd];
    
    // Create new version with all items
    const newVersion = await createNewPRVersion(
      prId,
      itemsToAdd,
      userId,
      `Added ${newItems.length} new item(s)`
    );
    
    return newVersion;
    
  } catch (error) {
    console.error('Error adding items to PR:', error);
    throw error;
  }
}

/**
 * Delete items from PR (soft delete, creates new version)
 */
export async function deleteItemsFromPR(prId, stableItemIds, userId) {
  try {
    // Mark items as deleted
    const deletedItems = stableItemIds.map(id => ({
      stable_item_id: id,
      deleted_at: new Date(),
      deleted_by: userId
    }));
    
    const newVersion = await createNewPRVersion(
      prId,
      deletedItems,
      userId,
      `Deleted ${stableItemIds.length} item(s)`
    );
    
    return newVersion;
    
  } catch (error) {
    console.error('Error deleting items from PR:', error);
    throw error;
  }
}

/**
 * Check if an item can be edited based on lifecycle status
 */
export function canEditItem(lifecycleStatus) {
  return lifecycleStatus === 'pending';
}

/**
 * Get version history for a PR
 */
export async function getPRVersionHistory(prId) {
  try {
    const result = await query(`
      SELECT 
        version,
        change_type,
        change_summary,
        items_affected,
        total_items,
        created_at,
        created_by,
        u.name as created_by_name
      FROM purchase_request_versions prv
      LEFT JOIN users u ON prv.created_by = u.id
      WHERE purchase_request_id = $1
      ORDER BY version DESC
    `, [prId]);
    
    return result.rows;
    
  } catch (error) {
    console.error('Error getting PR version history:', error);
    throw error;
  }
}

/**
 * Get specific version of PR items
 */
export async function getPRItemsAtVersion(prId, version) {
  try {
    const result = await query(`
      SELECT * FROM purchase_request_items_history
      WHERE purchase_request_id = $1 AND version = $2
      ORDER BY id
    `, [prId, version]);
    
    return result.rows;
    
  } catch (error) {
    console.error('Error getting PR items at version:', error);
    throw error;
  }
}
