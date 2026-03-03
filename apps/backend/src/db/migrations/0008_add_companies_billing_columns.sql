-- Add missing columns to companies table for testing
-- These columns exist in production core microservice but are missing from test schema
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS billing_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_address text;
