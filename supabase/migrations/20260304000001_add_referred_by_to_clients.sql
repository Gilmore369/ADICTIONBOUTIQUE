-- Add referred_by column to clients table
-- This column stores the ID of the client who referred this client

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_referred_by ON clients(referred_by);

-- Add comment
COMMENT ON COLUMN clients.referred_by IS 'ID of the client who referred this client';
