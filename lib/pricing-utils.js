// Pricing calculation utilities for Purchase Requests

/**
 * Calculate item-level pricing
 * @param {number} quantity - Item quantity
 * @param {number} unitPrice - Unit price (can be null)
 * @param {number} gstPercentage - GST percentage (e.g., 18 for 18%)
 * @returns {object} Pricing breakdown
 */
export function calculateItemPricing(quantity, unitPrice, gstPercentage = 0) {
  // If unit_price is null or missing, return null values
  if (!unitPrice || unitPrice === 0) {
    return {
      subtotal: null,
      gst_percentage: gstPercentage,
      gst_amount: null,
      amount_before_gst: null,
      item_total: null
    };
  }

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const gstPct = parseFloat(gstPercentage) || 0;

  const subtotal = qty * price;
  const gst_amount = subtotal * (gstPct / 100);
  const amount_before_gst = subtotal; // Same as subtotal for now (will differ with discounts)
  const item_total = amount_before_gst + gst_amount;

  return {
    subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimals
    gst_percentage: gstPct,
    gst_amount: Math.round(gst_amount * 100) / 100,
    amount_before_gst: Math.round(amount_before_gst * 100) / 100,
    item_total: Math.round(item_total * 100) / 100
  };
}

/**
 * Calculate PR-level aggregate pricing from items
 * @param {Array} items - Array of items with pricing
 * @returns {object} PR-level totals
 */
export function calculatePRTotals(items) {
  let items_value = 0;
  let gst_amount = 0;
  let final_value = 0;

  items.forEach(item => {
    if (item.subtotal !== null) {
      items_value += parseFloat(item.subtotal) || 0;
    }
    if (item.gst_amount !== null) {
      gst_amount += parseFloat(item.gst_amount) || 0;
    }
    if (item.item_total !== null) {
      final_value += parseFloat(item.item_total) || 0;
    }
  });

  return {
    items_value: Math.round(items_value * 100) / 100,
    gst_amount: Math.round(gst_amount * 100) / 100,
    final_value: Math.round(final_value * 100) / 100
  };
}
