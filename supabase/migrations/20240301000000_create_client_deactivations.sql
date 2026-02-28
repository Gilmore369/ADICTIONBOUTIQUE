-- Migration: Create client_deactivations table
-- Description: Creates table to track client deactivation history with reasons and audit trail
-- Requirements: 4.2, 4.3, 4.6

-- Create enum type for deactivation reasons
CREATE TYPE deactivation_reason AS ENUM ('FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO');

-- Create client_deactivations table
CREATE TABLE client_deactivations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reason deactivation_reason NOT NULL,
  notes TEXT,
  deactivated_by UUID NOT NULL REFERENCES users(id),
  deactivated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on client_id for faster lookups
CREATE INDEX idx_client_deactivations_client_id ON client_deactivations(client_id);

-- Create index on deactivated_at for temporal queries
CREATE INDEX idx_client_deactivations_deactivated_at ON client_deactivations(deactivated_at);

-- Add comment to table
COMMENT ON TABLE client_deactivations IS 'Tracks client deactivation history with reasons and audit information';

-- Add comments to columns
COMMENT ON COLUMN client_deactivations.client_id IS 'Reference to the deactivated client';
COMMENT ON COLUMN client_deactivations.reason IS 'Reason for deactivation: FALLECIDO (deceased), MUDADO (moved), DESAPARECIDO (disappeared), OTRO (other)';
COMMENT ON COLUMN client_deactivations.notes IS 'Additional notes about the deactivation';
COMMENT ON COLUMN client_deactivations.deactivated_by IS 'User who performed the deactivation';
COMMENT ON COLUMN client_deactivations.deactivated_at IS 'Timestamp when the deactivation occurred';
COMMENT ON COLUMN client_deactivations.created_at IS 'Record creation timestamp';
