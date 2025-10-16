-- ============================================================
-- BizModel Schema Addition
-- ============================================================

-- BizModel Definition
CREATE TABLE biz_models (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    service_charge_percentage NUMERIC(9,4) DEFAULT 0,
    max_discount_percentage NUMERIC(9,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- BizModel Project Stages
CREATE TABLE biz_model_stages (
    id SERIAL PRIMARY KEY,
    biz_model_id INTEGER REFERENCES biz_models(id) ON DELETE CASCADE,
    stage_code TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(biz_model_id, stage_code)
);

-- BizModel Payment Milestones
CREATE TABLE biz_model_milestones (
    id SERIAL PRIMARY KEY,
    biz_model_id INTEGER REFERENCES biz_models(id) ON DELETE CASCADE,
    milestone_code TEXT NOT NULL,
    milestone_name TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('inflow','outflow')) NOT NULL,
    default_percentage NUMERIC(9,4),
    stage_code TEXT,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE,
    sequence_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(biz_model_id, milestone_code)
);

-- Add biz_model_id to projects
ALTER TABLE projects ADD COLUMN biz_model_id INTEGER REFERENCES biz_models(id);
ALTER TABLE projects ADD COLUMN sales_order_id TEXT UNIQUE;

-- Add milestone and override fields to payments
ALTER TABLE customer_payments_in ADD COLUMN milestone_id INTEGER REFERENCES biz_model_milestones(id);
ALTER TABLE customer_payments_in ADD COLUMN expected_percentage NUMERIC(9,4);
ALTER TABLE customer_payments_in ADD COLUMN actual_percentage NUMERIC(9,4);
ALTER TABLE customer_payments_in ADD COLUMN override_reason TEXT;

ALTER TABLE payments_out ADD COLUMN milestone_id INTEGER REFERENCES biz_model_milestones(id);
ALTER TABLE payments_out ADD COLUMN expected_percentage NUMERIC(9,4);
ALTER TABLE payments_out ADD COLUMN actual_percentage NUMERIC(9,4);

-- Add service charge and discount to estimations
ALTER TABLE project_estimations ADD COLUMN service_charge_percentage NUMERIC(9,4) DEFAULT 0;
ALTER TABLE project_estimations ADD COLUMN service_charge_amount NUMERIC(20,2) DEFAULT 0;
ALTER TABLE project_estimations ADD COLUMN discount_percentage NUMERIC(9,4) DEFAULT 0;
ALTER TABLE project_estimations ADD COLUMN discount_amount NUMERIC(20,2) DEFAULT 0;
ALTER TABLE project_estimations ADD COLUMN final_value NUMERIC(20,2) DEFAULT 0;
ALTER TABLE project_estimations ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE project_estimations ADD COLUMN approval_status TEXT CHECK (approval_status IN ('pending','approved','rejected')) DEFAULT 'approved';
ALTER TABLE project_estimations ADD COLUMN approved_by INTEGER REFERENCES users(id);
ALTER TABLE project_estimations ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- Seed BizModel V1 (Based on KG Interiors workflow)
-- ============================================================

INSERT INTO biz_models (code, name, version, description, service_charge_percentage, max_discount_percentage) VALUES
('BIZ_MODEL_V1', 'KG Interiors Standard Model', 'V1', 'Standard interior design project workflow with 10% advance, 50% for 3D, 100% misc before execution', 10.0, 5.0);

-- Insert V1 Stages
INSERT INTO biz_model_stages (biz_model_id, stage_code, stage_name, sequence_order, description) VALUES
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'onboarding', 'Onboarding', 1, 'Initial customer onboarding and requirements gathering'),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), '2D', '2D Design', 2, '2D drawings with detailed quote'),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), '3D', '3D Design', 3, 'Detailed 3D design and visualization'),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'execution', 'Execution', 4, 'Project execution and installation'),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'handover', 'Handover', 5, 'Final handover and completion');

-- Insert V1 Payment Milestones (Inflow - Customer)
INSERT INTO biz_model_milestones (biz_model_id, milestone_code, milestone_name, direction, default_percentage, stage_code, description, sequence_order) VALUES
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'ADVANCE_10', 'Advance Payment (10%)', 'inflow', 10.0, '2D', 'Initial 10% advance to kickstart project', 1),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'START_3D_50', '3D Design Payment (50% including advance)', 'inflow', 50.0, '3D', 'Payment to start 3D design work (including initial 10%)', 2),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'MISC_100', 'Misc Items Payment (100%)', 'inflow', 100.0, 'execution', 'Full payment for misc items before execution starts', 3),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'FINAL_PAYMENT', 'Final Payment (100%)', 'inflow', 100.0, 'handover', 'Final settlement on project completion', 4);

-- Insert V1 Payment Milestones (Outflow - Vendor)
INSERT INTO biz_model_milestones (biz_model_id, milestone_code, milestone_name, direction, default_percentage, stage_code, description, sequence_order) VALUES
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'VENDOR_PI_ADVANCE', 'PI Vendor Advance (50% woodwork + 100% misc)', 'outflow', 50.0, 'execution', 'First installment to PI vendors', 1),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'VENDOR_PI_PROGRESS', 'PI Vendor Progress (80% woodwork + misc)', 'outflow', 80.0, 'execution', 'Progress payment on carcass installation', 2),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'VENDOR_PI_FINAL', 'PI Vendor Final (20% balance)', 'outflow', 20.0, 'handover', 'Final payment on handover', 3),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'VENDOR_ARISTO_ADVANCE', 'Aristo Vendor Advance (40%)', 'outflow', 40.0, 'execution', 'Advance on BOQ approval', 4),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'VENDOR_ARISTO_DISPATCH', 'Aristo Vendor on Dispatch (90%)', 'outflow', 90.0, 'execution', 'Payment on material dispatch (can be batched)', 5),
((SELECT id FROM biz_models WHERE code = 'BIZ_MODEL_V1'), 'VENDOR_OTHER_FULL', 'Other Vendor Full Payment', 'outflow', 100.0, 'execution', 'Full payment after customer signoff', 6);

-- Create indexes
CREATE INDEX idx_biz_models_code ON biz_models(code);
CREATE INDEX idx_biz_model_stages_model ON biz_model_stages(biz_model_id);
CREATE INDEX idx_biz_model_milestones_model ON biz_model_milestones(biz_model_id);
CREATE INDEX idx_projects_biz_model ON projects(biz_model_id);
CREATE INDEX idx_projects_sales_order ON projects(sales_order_id);
