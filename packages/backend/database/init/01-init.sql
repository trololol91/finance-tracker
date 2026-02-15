-- Initial database setup for Finance Tracker
-- This script runs automatically when the PostgreSQL container is first created

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create custom types (examples for future use)
-- CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
-- CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit', 'investment', 'cash');

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Finance Tracker database initialized successfully';
END $$;
