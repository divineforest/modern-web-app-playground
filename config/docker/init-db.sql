-- PostgreSQL Database Initialization Script
-- Creates both development and test databases

-- Create development database
CREATE DATABASE accounting_dev;

-- Create test database  
CREATE DATABASE accounting_test;

-- Create a dedicated user for the application (optional, using postgres user for simplicity)
-- CREATE USER accounting_user WITH PASSWORD 'accounting_password';
-- GRANT ALL PRIVILEGES ON DATABASE accounting_dev TO accounting_user;
-- GRANT ALL PRIVILEGES ON DATABASE accounting_test TO accounting_user;

-- Connect to development database and set up extensions
\c accounting_dev;

-- Enable commonly used PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Connect to test database and set up extensions
\c accounting_test;

-- Enable the same extensions for test database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
