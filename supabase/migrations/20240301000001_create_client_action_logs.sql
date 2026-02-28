-- Migration: Create client_action_logs table
-- Description: Creates table to track all client interactions and actions
-- Requirements: 7.1, 7.3

-- Create enum type for action types
CREATE TYPE action_type AS ENUM ('NOTA', 'LLAMADA', 'VISITA', 'MENSAJE', 'REACTIVACION');

-- Create client_action_logs table
CREATE TABLE client_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action_type action_type NOT NULL,
  description TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on client_id for faster lookups
CREATE INDEX idx_client_action_logs_client_id ON client_action_logs(client_id);

-- Create index on created_at for temporal queries and sorting
CREATE INDEX idx_client_action_logs_created_at ON client_action_logs(created_at DESC);

-- Create composite index for client_id and created_at (common query pattern)
CREATE INDEX idx_client_action_logs_client_created ON client_action_logs(client_id, created_at DESC);

-- Add comment to table
COMMENT ON TABLE client_action_logs IS 'Tracks all client interactions and actions for relationship management';

-- Add comments to columns
COMMENT ON COLUMN client_action_logs.client_id IS 'Reference to the client';
COMMENT ON COLUMN client_action_logs.action_type IS 'Type of action: NOTA (note), LLAMADA (call), VISITA (visit), MENSAJE (message), REACTIVACION (reactivation)';
COMMENT ON COLUMN client_action_logs.description IS 'Detailed description of the action';
COMMENT ON COLUMN client_action_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN client_action_logs.created_at IS 'Timestamp when the action was recorded';
