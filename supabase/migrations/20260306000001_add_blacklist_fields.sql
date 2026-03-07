-- Add blacklist fields to clients table
-- These fields track when and why a client was blacklisted

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- blacklisted_at: timestamp when client was added to blacklist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'blacklisted_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN blacklisted_at TIMESTAMPTZ;
  END IF;

  -- blacklisted_reason: reason for blacklisting
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'blacklisted_reason'
  ) THEN
    ALTER TABLE clients ADD COLUMN blacklisted_reason TEXT;
  END IF;

  -- blacklisted_by: user who added client to blacklist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'blacklisted_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN blacklisted_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Add index for faster blacklist queries
CREATE INDEX IF NOT EXISTS idx_clients_blacklisted ON clients(blacklisted) WHERE blacklisted = true;

-- Add comment
COMMENT ON COLUMN clients.blacklisted_at IS 'Timestamp when client was added to blacklist';
COMMENT ON COLUMN clients.blacklisted_reason IS 'Reason for blacklisting (DEUDA_EXCESIVA, NO_PAGA, DECISION_GERENCIA, MAL_COMPORTAMIENTO, OTRO)';
COMMENT ON COLUMN clients.blacklisted_by IS 'User who added client to blacklist';
