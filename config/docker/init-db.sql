-- PostgreSQL Database Initialization Script
-- Creates both development and test databases

-- Create development database
CREATE DATABASE mercado_dev;

-- Create test database  
CREATE DATABASE mercado_test;

-- Create a dedicated user for the application (optional, using postgres user for simplicity)
-- CREATE USER mercado_user WITH PASSWORD 'mercado_password';
-- GRANT ALL PRIVILEGES ON DATABASE mercado_dev TO mercado_user;
-- GRANT ALL PRIVILEGES ON DATABASE mercado_test TO mercado_user;

-- Connect to development database and set up extensions
\c mercado_dev;

-- Enable commonly used PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Connect to test database and set up extensions
\c mercado_test;

-- Enable the same extensions for test database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
