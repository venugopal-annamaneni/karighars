/**
 * Calculation Utilities for Estimation Items
 * Shared functions for both frontend and backend to ensure consistency
 */

/**
 * Calculate totals for a single estimation item
 * @param {Object} item - The estimation item
 * @param {Object} baseRates - Project base rates configuration
 * @returns {Object} Calculated totals for the item
 */
export function calculateItemTotal(item, baseRates) {
  // Extract category configuration
  const category = baseRates.category_rates?.categories?.find(c => c.id === item.category);
  if (!category) {
    throw new Error(`Category ${item.category} not found in base rates`);
  }

  // Parse numeric values
  const quantity = parseFloat(item.quantity) || 0;
  const unitPrice = parseFloat(item.unit_price || item.rate) || 0;
  const itemDiscountPct = parseFloat(item.item_discount_percentage) || 0;
  const kgDiscountPct = parseFloat(item.discount_kg_charges_percentage) || 0;
  
  // Get KG percentage from category or item
  const kgPercentage = parseFloat(item.karighar_charges_percentage || category.kg_percentage) || 0;
  
  // Get GST percentage from item or base rates
  const gstPercentage = parseFloat(item.gst_percentage || baseRates.gst_percentage) || 0;

  // Step 1: Calculate subtotal
  const subtotal = quantity * unitPrice;

  // Step 2: Apply item discount (BEFORE KG charges)
  const itemDiscountAmount = (subtotal * itemDiscountPct) / 100;
  const discountedSubtotal = subtotal - itemDiscountAmount;

  // Step 3: Calculate KG charges (on discounted subtotal)
  const kgChargesGross = (discountedSubtotal * kgPercentage) / 100;

  // Step 4: Apply KG discount (ON KG charges only)
  const kgDiscountAmount = (kgChargesGross * kgDiscountPct) / 100;
  const kgChargesNet = kgChargesGross - kgDiscountAmount;

  // Step 5: Calculate amount before GST (flag-based)
  let amountBeforeGst = 0;
  if (category.pay_to_vendor_directly) {
    // Customer pays vendor directly, only KG charges billed
    amountBeforeGst = kgChargesNet;
  } else {
    // Full billing: items + KG charges
    amountBeforeGst = discountedSubtotal + kgChargesNet;
  }

  // Step 6: Calculate GST
  const gstAmount = (amountBeforeGst * gstPercentage) / 100;

  // Step 7: Final item total
  const itemTotal = amountBeforeGst + gstAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    item_discount_amount: parseFloat(itemDiscountAmount.toFixed(2)),
    discounted_subtotal: parseFloat(discountedSubtotal.toFixed(2)),
    karighar_charges_gross: parseFloat(kgChargesGross.toFixed(2)),
    discount_kg_charges_amount: parseFloat(kgDiscountAmount.toFixed(2)),
    kg_discount_amount: parseFloat(kgDiscountAmount.toFixed(2)), // Alias for compatibility
    karighar_charges_amount: parseFloat(kgChargesNet.toFixed(2)),
    amount_before_gst: parseFloat(amountBeforeGst.toFixed(2)),
    gst_amount: parseFloat(gstAmount.toFixed(2)),
    item_total: parseFloat(itemTotal.toFixed(2))
  };
}

/**
 * Calculate category-wise and overall totals for multiple items
 * @param {Array} items - Array of estimation items (with calculated totals)
 * @param {Array} categories - Array of category configurations
 * @returns {Object} Category breakdown and overall totals
 */
export function calculateCategoryTotals(items, categories) {
  // Initialize dynamic accumulators for each category
  const categoryBreakdown = {};
  categories.forEach(cat => {
    categoryBreakdown[cat.id] = {
      subtotal: 0,
      item_discount_amount: 0,
      kg_charges_gross: 0,
      kg_charges_discount: 0,
      amount_before_gst: 0,
      gst_amount: 0,
      total: 0
    };
  });

  // High-level totals
  let totalItemsValue = 0;
  let totalItemsDiscount = 0;
  let totalKGCharges = 0;
  let totalKGDiscount = 0;
  let totalGST = 0;
  let grandTotal = 0;

  // Accumulate for each item
  items.forEach(item => {
    const categoryId = item.category;
    
    if (categoryBreakdown[categoryId]) {
      categoryBreakdown[categoryId].subtotal += item.subtotal;
      categoryBreakdown[categoryId].item_discount_amount += item.item_discount_amount;
      categoryBreakdown[categoryId].kg_charges_gross += item.karighar_charges_gross;
      categoryBreakdown[categoryId].kg_charges_discount += (item.discount_kg_charges_amount || item.kg_discount_amount || 0);
      categoryBreakdown[categoryId].amount_before_gst += item.amount_before_gst;
      categoryBreakdown[categoryId].gst_amount += item.gst_amount;
      categoryBreakdown[categoryId].total += item.item_total;
    }

    // Accumulate high-level totals
    totalItemsValue += item.subtotal;
    totalItemsDiscount += item.item_discount_amount;
    totalKGCharges += item.karighar_charges_gross;
    totalKGDiscount += (item.discount_kg_charges_amount || item.kg_discount_amount || 0);
    totalGST += item.gst_amount;
    grandTotal += item.item_total;
  });

  return {
    category_breakdown: categoryBreakdown,
    items_value: parseFloat(totalItemsValue.toFixed(2)),
    items_discount: parseFloat(totalItemsDiscount.toFixed(2)),
    kg_charges: parseFloat(totalKGCharges.toFixed(2)),
    kg_charges_discount: parseFloat(totalKGDiscount.toFixed(2)),
    gst_amount: parseFloat(totalGST.toFixed(2)),
    final_value: parseFloat(grandTotal.toFixed(2))
  };
}

/**
 * Calculate totals for all items (combines calculateItemTotal and calculateCategoryTotals)
 * Useful for frontend where you need both item-level and aggregated totals
 * @param {Array} items - Array of estimation items (raw data)
 * @param {Object} baseRates - Project base rates configuration
 * @returns {Object} Items with calculated totals and overall breakdown
 */
export function calculateAllTotals(items, baseRates) {
  const categories = baseRates.category_rates?.categories || [];
  
  // Calculate item-level totals
  const itemsWithTotals = items.map(item => ({
    ...item,
    ...calculateItemTotal(item, baseRates)
  }));

  // Calculate category and overall totals
  const totals = calculateCategoryTotals(itemsWithTotals, categories);

  return {
    items: itemsWithTotals,
    ...totals
  };
}

/**
 * Validate if an item's discount percentages are within allowed limits
 * @param {Object} item - The estimation item
 * @param {Object} category - Category configuration
 * @returns {Object} Validation result with errors/warnings
 */
export function validateItemDiscounts(item, category) {
  const errors = [];
  const warnings = [];

  const itemDiscountPct = parseFloat(item.item_discount_percentage) || 0;
  const kgDiscountPct = parseFloat(item.discount_kg_charges_percentage) || 0;

  // Check item discount limit
  const maxItemDiscount = category.max_item_discount_percentage || 0;
  if (itemDiscountPct > maxItemDiscount) {
    errors.push({
      field: 'item_discount_percentage',
      message: `Item discount ${itemDiscountPct}% exceeds maximum ${maxItemDiscount}% for ${category.category_name}`
    });
  }

  // Check KG discount limit
  const maxKGDiscount = category.max_kg_discount_percentage || 0;
  if (kgDiscountPct > maxKGDiscount) {
    errors.push({
      field: 'discount_kg_charges_percentage',
      message: `KG discount ${kgDiscountPct}% exceeds maximum ${maxKGDiscount}% for ${category.category_name}`
    });
  }

  // Warning for high discounts
  if (itemDiscountPct > maxItemDiscount * 0.8) {
    warnings.push({
      field: 'item_discount_percentage',
      message: `Item discount ${itemDiscountPct}% is close to maximum limit`
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// For CommonJS compatibility (Node.js backend)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateItemTotal,
    calculateCategoryTotals,
    calculateAllTotals,
    validateItemDiscounts
  };
}
