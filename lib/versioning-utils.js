// Versioning utilities for Purchase Requests
import { query } from '@/lib/db';
import { calculateItemPricing, calculatePRTotals } from '@/lib/pricing-utils';

/**
 * Create a new version for a PR by moving all current items to history
 * and re-inserting them with a new version number
 * 
 * OPTIMIZED: Uses bulk operations and CTEs for better performance
 * 
 * @param {number} prId - Purchase request ID
 * @param {Array} updatedItems - Array of items with updates (must include stable_item_id and estimation_links)
 * @param {number} userId - User making the change
 * @param {string} changeSummary - Description of what changed
 * @returns {Promise<number>} New version number
 */
export async function createNewPRVersion(prId, updatedItems, userId, changeSummary) {
  try {
    // 1️⃣ Combined metadata query: get version + current items with links
    const metaResult = await query(`
      SELECT 
        (SELECT COALESCE(MAX(version), 0) FROM purchase_request_items WHERE purchase_request_id = $1) as current_version,
        json_agg(
          json_build_object(
            'id', pri.id,
            'stable_item_id', pri.stable_item_id,
            'purchase_request_id', pri.purchase_request_id,
            'version', pri.version,
            'purchase_request_item_name', pri.purchase_request_item_name,
            'category', pri.category,
            'room_name', pri.room_name,
            'quantity', pri.quantity,
            'unit', pri.unit,
            'width', pri.width,
            'height', pri.height,
            'unit_price', pri.unit_price,
            'subtotal', pri.subtotal,
            'gst_percentage', pri.gst_percentage,
            'gst_amount', pri.gst_amount,
            'amount_before_gst', pri.amount_before_gst,
            'item_total', pri.item_total,
            'lifecycle_status', pri.lifecycle_status,
            'is_direct_purchase', pri.is_direct_purchase,
            'status', pri.status,
            'created_at', pri.created_at,
            'created_by', pri.created_by,
            'updated_at', pri.updated_at,
            'updated_by', pri.updated_by,
            'estimation_links', COALESCE(
              (SELECT json_agg(
                json_build_object(
                  'id', prel.id,
                  'stable_estimation_item_id', prel.stable_estimation_item_id,
                  'linked_qty', prel.linked_qty,
                  'weightage', prel.unit_purchase_request_item_weightage,
                  'notes', prel.notes
                )
              ) FROM purchase_request_estimation_links prel WHERE prel.stable_item_id = pri.stable_item_id),
              '[]'::json
            )
          )
        ) as current_items
      FROM purchase_request_items pri
      WHERE pri.purchase_request_id = $1
    `, [prId]);
    
    const currentVersion = metaResult.rows[0].current_version;
    const currentItems = metaResult.rows[0].current_items || [];
    const newVersion = currentVersion + 1;
    
    if (currentItems.length === 0) {
      throw new Error('No items found in purchase request');
    }
    
    console.log(`Creating version ${newVersion} for PR ${prId} with ${updatedItems.length} items`);
    
    // 2️⃣ Build map of current items for preserving created_at/created_by
    const currentItemsMap = new Map();
    currentItems.forEach(item => {
      if (item.stable_item_id) {
        currentItemsMap.set(item.stable_item_id, {
          created_at: item.created_at,
          created_by: item.created_by,
          ...item
        });
      }
    });
    
    // 3️⃣ Archive + delete items in one atomic operation (CTE)
    await query(`
      WITH deleted_items AS (
        DELETE FROM purchase_request_items
        WHERE purchase_request_id = $1
        RETURNING *
      )
      INSERT INTO purchase_request_items_history (
        id, stable_item_id, purchase_request_id, version,
        purchase_request_item_name, category, room_name,
        quantity, unit, width, height,
        unit_price, subtotal, gst_percentage, gst_amount,
        amount_before_gst, item_total,
        lifecycle_status, is_direct_purchase, status,
        created_at, created_by, updated_at, updated_by,
        archived_at, archived_by
      )
      SELECT 
        id, stable_item_id, purchase_request_id, version,
        purchase_request_item_name, category, room_name,
        quantity, unit, width, height,
        unit_price, subtotal, gst_percentage, gst_amount,
        amount_before_gst, item_total,
        lifecycle_status, is_direct_purchase, status,
        created_at, created_by, updated_at, updated_by,
        NOW(), $2
      FROM deleted_items
    `, [prId, userId]);
    
    // 4️⃣ Archive + delete links in one atomic operation (CTE)
    await query(`
      WITH deleted_links AS (
        DELETE FROM purchase_request_estimation_links
        WHERE stable_item_id IN (
          SELECT UNNEST($1::uuid[])
        )
        RETURNING *
      )
      INSERT INTO purchase_request_estimation_links_history (
        id, stable_item_id, stable_estimation_item_id, version,
        linked_qty, unit_purchase_request_item_weightage, notes,
        created_at, archived_at
      )
      SELECT 
        id, stable_item_id, stable_estimation_item_id, version,
        linked_qty, unit_purchase_request_item_weightage, notes,
        created_at, NOW()
      FROM deleted_links
    `, [currentItems.map(i => i.stable_item_id)]);
    
    console.log(`Archived ${currentItems.length} items and their links to history`);
    
    // 5️⃣ No need to pre-fetch - all links should have stable_estimation_item_id
    
    // 6️⃣ Prepare items for bulk insert with pricing calculations
    const itemsAffected = [];
    const itemPlaceholders = [];
    const itemValues = [];
    let itemIdx = 1;
    
    for (const payloadItem of updatedItems) {
      const currentItem = currentItemsMap.get(payloadItem.stable_item_id);
      
      if (!currentItem) {
        console.warn(`Item ${payloadItem.stable_item_id} not found in current items, skipping`);
        continue;
      }
      
      // Merge current data with payload updates
      const itemData = { ...currentItem, ...payloadItem };
      itemsAffected.push(payloadItem.stable_item_id);
      
      // Recalculate pricing if price/quantity changed
      let pricing = {
        subtotal: itemData.subtotal,
        gst_percentage: itemData.gst_percentage,
        gst_amount: itemData.gst_amount,
        amount_before_gst: itemData.amount_before_gst,
        item_total: itemData.item_total
      };
      
      if (payloadItem.unit_price !== undefined || payloadItem.quantity !== undefined) {
        pricing = calculateItemPricing(
          itemData.quantity,
          itemData.unit_price,
          itemData.gst_percentage || 0
        );
      }
      
      // Preserve created_at/created_by from original item
      const preservedCreatedAt = currentItem.created_at;
      const preservedCreatedBy = currentItem.created_by;
      
      itemPlaceholders.push(`(
        $${itemIdx++}, $${itemIdx++}, $${itemIdx++},
        $${itemIdx++}, $${itemIdx++}, $${itemIdx++},
        $${itemIdx++}, $${itemIdx++}, $${itemIdx++}, $${itemIdx++},
        $${itemIdx++}, $${itemIdx++}, $${itemIdx++}, $${itemIdx++},
        $${itemIdx++}, $${itemIdx++},
        $${itemIdx++}, $${itemIdx++}, $${itemIdx++},
        $${itemIdx++}, $${itemIdx++}, NOW(), $${itemIdx++}
      )`);
      
      itemValues.push(
        itemData.stable_item_id,
        prId,
        newVersion,
        itemData.purchase_request_item_name,
        itemData.category,
        itemData.room_name,
        itemData.quantity,
        itemData.unit,
        itemData.width || null,
        itemData.height || null,
        itemData.unit_price,
        pricing.subtotal,
        pricing.gst_percentage,
        pricing.gst_amount,
        pricing.amount_before_gst,
        pricing.item_total,
        itemData.lifecycle_status || 'pending',
        itemData.is_direct_purchase,
        itemData.status,
        preservedCreatedAt,  // Preserve original created_at
        preservedCreatedBy,  // Preserve original created_by
        userId               // Current user as updated_by
      );
    }
    
    // 7️⃣ Bulk insert items (no need for RETURNING anymore)
    await query(`
      INSERT INTO purchase_request_items (
        stable_item_id, purchase_request_id, version,
        purchase_request_item_name, category, room_name,
        quantity, unit, width, height,
        unit_price, subtotal, gst_percentage, gst_amount,
        amount_before_gst, item_total,
        lifecycle_status, is_direct_purchase, status,
        created_at, created_by, updated_at, updated_by
      ) VALUES ${itemPlaceholders.join(', ')}
    `, itemValues);
    
    console.log(`Bulk inserted ${updatedItems.length} items`);
    
    // 8️⃣ Prepare links for bulk insert (simplified without purchase_request_item_id)
    const allLinks = [];
    for (const payloadItem of updatedItems) {
      const currentItem = currentItemsMap.get(payloadItem.stable_item_id);
      if (!currentItem) continue;
      
      // Determine which links to use
      let linksToInsert = [];
      if (payloadItem.estimation_links !== undefined) {
        linksToInsert = payloadItem.estimation_links || [];
      } else {
        linksToInsert = currentItem.estimation_links || [];
      }
      
      // Process each link
      for (const link of linksToInsert) {
        let stableEstimationItemId = link.stable_estimation_item_id;
        
        // Fetch from pre-loaded map if needed (backward compatibility)
        if (!stableEstimationItemId && link.estimation_item_id) {
          stableEstimationItemId = stableEstIdMap.get(link.estimation_item_id);
        }
        
        if (stableEstimationItemId) {
          allLinks.push({
            stable_item_id: payloadItem.stable_item_id,
            stable_estimation_item_id: stableEstimationItemId,
            version: newVersion,
            linked_qty: link.linked_qty || 0,
            weightage: link.weightage || link.unit_purchase_request_item_weightage || 1.0,
            notes: link.notes || null
          });
        }
      }
    }
    
    // 9️⃣ Bulk insert links (simplified without version-dependent IDs)
    if (allLinks.length > 0) {
      const linkPlaceholders = [];
      const linkValues = [];
      let linkIdx = 1;
      
      for (const link of allLinks) {
        linkPlaceholders.push(`(
          $${linkIdx++}, $${linkIdx++}, $${linkIdx++},
          $${linkIdx++}, $${linkIdx++}, $${linkIdx++}
        )`);
        
        linkValues.push(
          link.stable_item_id,
          link.stable_estimation_item_id,
          link.version,
          link.linked_qty,
          link.weightage,
          link.notes
        );
      }
      
      await query(`
        INSERT INTO purchase_request_estimation_links (
          stable_item_id, stable_estimation_item_id, version,
          linked_qty, unit_purchase_request_item_weightage, notes
        ) VALUES ${linkPlaceholders.join(', ')}
      `, linkValues);
      
      console.log(`Bulk inserted ${allLinks.length} estimation links`);
    }
    
    // 🔟 Recalculate PR-level totals
    await recalculatePRTotals(prId);
    
    // 1️⃣1️⃣ Determine change type
    const deletedCount = currentItems.length - updatedItems.length;
    let changeType = 'items_edited';
    if (deletedCount > 0) {
      changeType = deletedCount === currentItems.length ? 'all_items_deleted' : 'items_deleted';
    } else if (updatedItems.length > currentItems.length) {
      changeType = 'items_added';
    }
    
    // 1️⃣2️⃣ Create version record
    await query(`
      INSERT INTO purchase_request_versions (
        purchase_request_id, version, change_type,
        change_summary, items_affected, total_items,
        created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
    `, [
      prId,
      newVersion,
      changeType,
      changeSummary,
      itemsAffected,
      updatedItems.length,
      userId
    ]);
    
    console.log(`Successfully created version ${newVersion} for PR ${prId}`);
    return newVersion;
    
  } catch (error) {
    console.error('Error creating new PR version:', error);
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
 * Delete items from PR (hard delete, creates new version)
 * Simply re-insert all items EXCEPT the ones to delete
 */
export async function deleteItemsFromPR(prId, stableItemIds, userId) {
  try {
    // Get all current items
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
    
    // Filter out items to delete
    const itemsToKeep = currentItemsResult.rows.filter(
      item => !stableItemIds.includes(item.stable_item_id)
    );
    
    // Create new version with only the items to keep
    const newVersion = await createNewPRVersion(
      prId,
      itemsToKeep,
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
