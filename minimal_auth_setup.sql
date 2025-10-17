-- Quick test to run from your machine to create database and basic auth tables

-- Connect to postgres database first:
-- PGPASSWORD='Karighars$2025!!' psql -h database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com -U postgres -p 5432 -d postgres

-- Create database if not exists
CREATE DATABASE kg_interiors_finance;

-- Now connect to the new database and run the rest:
-- \c kg_interiors_finance

-- Or reconnect with:
-- PGPASSWORD='Karighars$2025!!' psql -h database-1.cx2yg0q8o2qj.ap-south-1.rds.amazonaws.com -U postgres -p 5432 -d kg_interiors_finance

-- Create minimal auth tables for immediate login
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified TIMESTAMPTZ,
    image VARCHAR(255),
    role TEXT DEFAULT 'sales' CHECK (role IN ('estimator', 'finance', 'sales', 'designer', 'project_manager', 'admin')),
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    UNIQUE(identifier, token)
);

-- Test the setup
SELECT 'Auth tables created successfully!' as status;
SELECT COUNT(*) as user_count FROM users;
