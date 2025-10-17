-- Migration: Rename phase column to stage in projects table
-- Run this on your database before deploying code changes

ALTER TABLE projects RENAME COLUMN phase TO stage;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'stage';
