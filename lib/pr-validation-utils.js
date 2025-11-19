// Purchase Request Validation Utilities
import { query } from '@/lib/db';

/**
 * Validate PR item quantities against estimation item availability
 * Checks that requested quantities don't exceed available quantities
 * considering both confirmed and draft PRs
 * 
 * @param {string} projectId - Project ID
 * @param {Array} items - PR items to validate (each with links array)
 * @param {string} estimationId - Estimation ID
 * @param {string|null} excludePRId - PR ID to exclude from draft calculations (for edit scenarios)
 * @returns {Promise<Array>} Array of error messages (empty if valid)
 */
export async function validatePRQuantities(projectId, items, estimationId, excludePRId = null) {
  try {
    // Get current allocations for all estimation items
    const allocationsQuery = `
      SELECT 
        ei.stable_item_id,
        ei.item_name,
        ei.category,
        ei.room_name,
        ei.unit,
        ei.quantity as total_qty,
        COALESCE(
          SUM(prel.linked_qty * prel.unit_purchase_request_item_weightage) 
          FILTER (WHERE pr.status = 'confirmed'),
          0
        ) as confirmed_allocated,
        COALESCE(
          SUM(prel.linked_qty * prel.unit_purchase_request_item_weightage) 
          FILTER (WHERE pr.status = 'draft' AND ($2::INTEGER IS NULL OR pr.id != $2)),
          0
        ) as draft_allocated
      FROM estimation_items ei
      LEFT JOIN purchase_request_estimation_links prel 
        ON ei.stable_item_id = prel.stable_estimation_item_id
      LEFT JOIN purchase_request_items pri 
        ON prel.stable_item_id = pri.stable_item_id
      LEFT JOIN purchase_requests pr 
        ON pri.purchase_request_id = pr.id AND pr.project_id = $3
      WHERE ei.estimation_id = $1
      GROUP BY ei.stable_item_id, ei.item_name, ei.category, ei.room_name, ei.unit, ei.quantity
    `;
    
    const allocationsResult = await query(allocationsQuery, [estimationId, excludePRId, projectId]);
    
    // Build map of allocations by stable_item_id
    const allocations = new Map();
    allocationsResult.rows.forEach(row => {
      allocations.set(row.stable_item_id, {
        item_name: row.item_name,
        category: row.category,
        room_name: row.room_name,
        unit: row.unit,
        total_qty: parseFloat(row.total_qty),
        confirmed: parseFloat(row.confirmed_allocated),
        draft: parseFloat(row.draft_allocated)
      });
    });
    
    // Validate each PR item
    const errors = [];
    
    for (const item of items) {
      // Skip items without links (direct purchase items)
      const itemLinks = item.links || item.estimation_links || [];
      if (itemLinks.length === 0) {
        continue;
      }
      
      for (const link of itemLinks) {
        const stableEstId = link.stable_estimation_item_id;
        
        if (!stableEstId) {
          errors.push(`Item "${item.name}": Missing estimation item reference`);
          continue;
        }
        
        const allocation = allocations.get(stableEstId);
        
        if (!allocation) {
          errors.push(`Item "${item.name}": Linked estimation item not found`);
          continue;
        }
        
        // Calculate requested quantity considering weightage
        const linkedQty = parseFloat(link.linked_qty) || 0;
        const weightage = parseFloat(link.weightage || link.unit_purchase_request_item_weightage || 1.0);
        const requestedQty = linkedQty * weightage;
        
        // Calculate available quantity
        const available = allocation.total_qty - allocation.confirmed - allocation.draft;
        
        // Validate
        if (requestedQty > available) {
          const estItemLabel = `${allocation.category} - ${allocation.room_name} - ${allocation.item_name}`;
          errors.push(
            `Item "${item.name}" linked to "${estItemLabel}": ` +
            `Requested ${requestedQty.toFixed(2)} ${allocation.unit} exceeds available ${available.toFixed(2)} ${allocation.unit}. ` +
            `(Total: ${allocation.total_qty}, Confirmed: ${allocation.confirmed.toFixed(2)}, Draft: ${allocation.draft.toFixed(2)})`
          );
        }
      }
    }
    
    return errors;
    
  } catch (error) {
    console.error('Error validating PR quantities:', error);
    throw new Error('Failed to validate quantities: ' + error.message);
  }
}

/**
 * Get available quantities for all estimation items
 * Used by frontend to display real-time availability
 * 
 * @param {string} estimationId - Estimation ID
 * @param {string} projectId - Project ID
 * @param {string|null} excludePRId - PR ID to exclude from calculations
 * @returns {Promise<Array>} Array of items with allocation info
 */
export async function getEstimationItemAllocations(estimationId, projectId, excludePRId = null) {
  try {
    const allocationsQuery = `
      SELECT 
        ei.id,
        ei.stable_item_id,
        ei.item_name,
        ei.category,
        ei.room_name,
        ei.unit,
        ei.quantity as total_qty,
        COALESCE(
          SUM(prel.linked_qty * prel.unit_purchase_request_item_weightage) 
          FILTER (WHERE pr.status = 'confirmed'),
          0
        ) as confirmed_allocated,
        COALESCE(
          SUM(prel.linked_qty * prel.unit_purchase_request_item_weightage) 
          FILTER (WHERE pr.status = 'draft' AND ($2::INTEGER IS NULL OR pr.id != $2)),
          0
        ) as draft_allocated,
        (
          ei.quantity - 
          COALESCE(
            SUM(prel.linked_qty * prel.unit_purchase_request_item_weightage) 
            FILTER (WHERE pr.status = 'confirmed'),
            0
          ) -
          COALESCE(
            SUM(prel.linked_qty * prel.unit_purchase_request_item_weightage) 
            FILTER (WHERE pr.status = 'draft' AND ($2::INTEGER IS NULL OR pr.id != $2)),
            0
          )
        ) as available_qty
      FROM estimation_items ei
      LEFT JOIN purchase_request_estimation_links prel 
        ON ei.stable_item_id = prel.stable_estimation_item_id
      LEFT JOIN purchase_request_items pri 
        ON prel.stable_item_id = pri.stable_item_id
      LEFT JOIN purchase_requests pr 
        ON pri.purchase_request_id = pr.id AND pr.project_id = $3
      WHERE ei.estimation_id = $1
      GROUP BY ei.id, ei.stable_item_id, ei.item_name, ei.category, ei.room_name, ei.unit, ei.quantity
      ORDER BY ei.category, ei.room_name, ei.item_name
    `;
    
    const result = await query(allocationsQuery, [estimationId, excludePRId, projectId]);
    
    return result.rows.map(row => ({
      id: row.id,
      stable_item_id: row.stable_item_id,
      item_name: row.item_name,
      category: row.category,
      room_name: row.room_name,
      unit: row.unit,
      total_qty: parseFloat(row.total_qty),
      confirmed_allocated: parseFloat(row.confirmed_allocated),
      draft_allocated: parseFloat(row.draft_allocated),
      available_qty: parseFloat(row.available_qty)
    }));
    
  } catch (error) {
    console.error('Error getting estimation item allocations:', error);
    throw new Error('Failed to get allocations: ' + error.message);
  }
}
