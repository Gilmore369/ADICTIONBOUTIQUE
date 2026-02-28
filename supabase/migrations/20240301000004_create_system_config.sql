-- Migration: Create system_config table
-- Description: Create system_config table for storing system-wide configuration values
-- Requirements: 3.3

-- Create system_config table
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE system_config IS 'System-wide configuration key-value pairs';
COMMENT ON COLUMN system_config.key IS 'Unique configuration key identifier';
COMMENT ON COLUMN system_config.value IS 'Configuration value stored as text';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of the configuration';
COMMENT ON COLUMN system_config.updated_at IS 'Timestamp of last update';

-- Insert default configuration values
INSERT INTO system_config (key, value, description, updated_at) VALUES
  ('inactivity_threshold_days', '90', 'Number of days without purchases before a client is considered inactive', NOW());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on changes
CREATE TRIGGER trigger_update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_system_config_updated_at();
