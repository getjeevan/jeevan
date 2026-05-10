-- Runs once when the PostgreSQL container first starts.
-- Creates the coder user and database for Coder IDE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'coder') THEN
    CREATE USER coder WITH PASSWORD 'coderpass';
  END IF;
END
$$;

CREATE DATABASE coder OWNER coder;
GRANT ALL PRIVILEGES ON DATABASE coder TO coder;
