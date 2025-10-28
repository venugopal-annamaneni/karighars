-- Migration: Drop and recreate estimation_items with better column ordering
-- WARNING: This will delete all existing data in estimation_items table

-- Step 1: Drop the table
DROP TABLE IF EXISTS estimation_items CASCADE;

-- Step 2: Drop and recreate sequence
DROP SEQUENCE IF EXISTS estimation_items_id_seq CASCADE;
CREATE SEQUENCE estimation_items_id_seq;

-- Step 3: Create table with new structure
CREATE TABLE estimation_items (
    -- Identifiers & Relations
    id INTEGER NOT NULL DEFAULT nextval('estimation_items_id_seq'::regclass),
    estimation_id INTEGER REFERENCES project_estimations(id) ON DELETE CASCADE,
    
    -- Classification
    category TEXT CHECK (category = ANY (ARRAY['woodwork', 'misc_internal', 'misc_external', 'shopping_service'])),
    room_name VARCHAR NOT NULL,
    vendor_type TEXT CHECK (vendor_type = ANY (ARRAY['PI', 'Aristo', 'Other'])),

    -- Item details
    item_name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit = ANY (ARRAY['sqft', 'no', 'lumpsum'])),
    width NUMERIC,
    height NUMERIC,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,

    -- Charges and Discounts
    karighar_charges_percentage NUMERIC DEFAULT 10,
    karighar_charges_amount NUMERIC DEFAULT 0,

    -- Item-level discount
    item_discount_percentage NUMERIC DEFAULT 0,
    item_discount_amount NUMERIC DEFAULT 0,

    -- Karighar charges discount
    discount_kg_charges_percentage NUMERIC DEFAULT 0,
    discount_kg_charges_amount NUMERIC DEFAULT 0,

    -- Taxation
    gst_percentage NUMERIC DEFAULT 18,
    gst_amount NUMERIC DEFAULT 0,

    -- Computed Totals
    amount_before_gst NUMERIC DEFAULT 0,
    item_total NUMERIC DEFAULT 0,
    total NUMERIC,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,

    PRIMARY KEY (id)
);

-- Step 4: Add column comments
COMMENT ON COLUMN estimation_items.quantity IS 'Quantity - auto-calculated (width x height) for sqft, manual input for no/lumpsum';
COMMENT ON COLUMN estimation_items.unit IS 'Unit of measurement: sqft (area), no (count), lumpsum (fixed)';
COMMENT ON COLUMN estimation_items.karighar_charges_percentage IS 'KG charges percentage - D&C for woodwork, Service charge for misc/shopping';
COMMENT ON COLUMN estimation_items.item_discount_percentage IS 'Discount percentage on subtotal (applied before KG charges)';
COMMENT ON COLUMN estimation_items.item_discount_amount IS 'Discount amount calculated on item subtotal';
COMMENT ON COLUMN estimation_items.discount_kg_charges_percentage IS 'Discount percentage applied on Karighar charges portion';
COMMENT ON COLUMN estimation_items.discount_kg_charges_amount IS 'Discount amount calculated on Karighar charges portion';
COMMENT ON COLUMN estimation_items.gst_percentage IS 'GST percentage applicable on this item';
COMMENT ON COLUMN estimation_items.subtotal IS 'Quantity × Unit Price';
COMMENT ON COLUMN estimation_items.karighar_charges_amount IS 'Subtotal × karighar_charges_percentage';
COMMENT ON COLUMN estimation_items.amount_before_gst IS 'Amount after discounts and KG charges, before GST';
COMMENT ON COLUMN estimation_items.gst_amount IS 'GST amount';
COMMENT ON COLUMN estimation_items.item_total IS 'Final item total including all charges and GST';
COMMENT ON COLUMN estimation_items.room_name IS 'Room or section name (e.g., Living Room, Kitchen) - mandatory';
COMMENT ON COLUMN estimation_items.width IS 'Width dimension - used only when unit = sqft';
COMMENT ON COLUMN estimation_items.height IS 'Height dimension - used only when unit = sqft';

-- Step 5: Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'estimation_items' 
ORDER BY ordinal_position;
