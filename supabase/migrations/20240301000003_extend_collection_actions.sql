-- Migration: Extend collection_actions table with new fields
-- Description: Add description, follow_up_date, completed, and completed_at fields
-- Requirements: 8.1, 8.4

-- Add new columns to collection_actions table
ALTER TABLE collection_actions
  ADD COLUMN description TEXT,
  ADD COLUMN follow_up_date DATE,
  ADD COLUMN completed BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN completed_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX idx_collection_actions_follow_up_date ON collection_actions(follow_up_date);
CREATE INDEX idx_collection_actions_completed ON collection_actions(completed);
CREATE INDEX idx_collection_actions_completed_follow_up ON collection_actions(completed, follow_up_date) 
  WHERE completed = FALSE;

-- Add comments for documentation
COMMENT ON COLUMN collection_actions.description IS 'Detailed description of the collection action';
COMMENT ON COLUMN collection_actions.follow_up_date IS 'Date when follow-up is required';
COMMENT ON COLUMN collection_actions.completed IS 'Whether the action has been completed';
COMMENT ON COLUMN collection_actions.completed_at IS 'Timestamp when the action was marked as completed';
