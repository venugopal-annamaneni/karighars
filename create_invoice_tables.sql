-- Create project_invoices table
CREATE TABLE project_invoices (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    invoice_number VARCHAR(100),
    invoice_amount NUMERIC(20,2) NOT NULL,
    invoice_date DATE,
    invoice_document_url TEXT,
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by INTEGER NOT NULL,
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    cancelled_by INTEGER,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (cancelled_by) REFERENCES users(id),
    CHECK (status IN ('pending', 'approved', 'cancelled'))
);

CREATE INDEX idx_project_invoices_project_id ON project_invoices(project_id);
CREATE INDEX idx_project_invoices_status ON project_invoices(status);

COMMENT ON COLUMN project_invoices.invoice_amount IS 'Invoice amount to be realized as revenue';
COMMENT ON COLUMN project_invoices.status IS 'pending/approved/cancelled';
COMMENT ON COLUMN project_invoices.invoice_document_url IS 'Uploaded invoice document';

-- Add invoiced_amount column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(20,2) DEFAULT 0;

COMMENT ON COLUMN projects.invoiced_amount IS 'Total approved invoice amount (realized revenue)';
