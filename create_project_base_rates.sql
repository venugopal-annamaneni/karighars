-- Migration: Create project_base_rates table and update projects table
-- Purpose: Enable project-level rate overrides with approval workflow

BEGIN;

-- Create project_base_rates table
CREATE TABLE project_base_rates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Rate configurations (copied from biz_model)
    service_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_service_charge_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 50,
    design_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_design_charge_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 50,
    shopping_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_shopping_charge_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 50,
    gst_percentage NUMERIC(5,2) NOT NULL DEFAULT 18,
    
    -- Workflow fields
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    active BOOLEAN NOT NULL DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Approval/Rejection fields
    approved_at TIMESTAMPTZ,
    approved_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by INTEGER REFERENCES users(id),
    comments TEXT,
    
    -- Constraints
    CHECK (status IN ('requested', 'approved', 'rejected')),
    CHECK (active IN (true, false))
);

-- Add base_rate_id to projects table
ALTER TABLE projects
    ADD COLUMN base_rate_id INTEGER REFERENCES project_base_rates(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_project_base_rates_project_id ON project_base_rates(project_id);
CREATE INDEX idx_project_base_rates_active ON project_base_rates(project_id, active) WHERE active = true;
CREATE INDEX idx_projects_base_rate_id ON projects(base_rate_id);

-- IMPORTANT: Unique index to ensure only one active base_rate per project
CREATE UNIQUE INDEX idx_project_base_rates_one_active 
    ON project_base_rates(project_id) 
    WHERE active = true;

-- Comments for documentation
COMMENT ON TABLE project_base_rates IS 'Project-specific base rate configurations with approval workflow';
COMMENT ON COLUMN project_base_rates.project_id IS 'Reference to projects table';
COMMENT ON COLUMN project_base_rates.status IS 'requested: pending approval, approved: approved, rejected: denied';
COMMENT ON COLUMN project_base_rates.active IS 'Only one row can be active per project at a time (enforced by unique index)';
COMMENT ON COLUMN project_base_rates.comments IS 'Justification for request or reason for rejection';
COMMENT ON COLUMN projects.base_rate_id IS 'Currently active base rate configuration for this project';

COMMIT;

-- Verify
SELECT 
    'project_base_rates' as table_name, 
    COUNT(*) as count 
FROM project_base_rates;

SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'project_base_rates' 
ORDER BY ordinal_position;
