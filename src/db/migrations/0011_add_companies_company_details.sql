-- Add company_details JSONB column to companies table for testing
-- This column exists in production core microservice but is missing from test schema
-- The column stores company-specific details like vatId, address, etc.
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS company_details jsonb NOT NULL DEFAULT '{}'::jsonb;
