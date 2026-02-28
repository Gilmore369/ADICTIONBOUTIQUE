-- Migration: Create client_ratings table
-- Description: Creates table to store calculated client ratings and scores
-- Requirements: 2.1, 2.11

-- Create enum type for rating categories
CREATE TYPE rating_category AS ENUM ('A', 'B', 'C', 'D');

-- Create client_ratings table
CREATE TABLE client_ratings (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  rating rating_category NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  payment_punctuality INTEGER NOT NULL CHECK (payment_punctuality >= 0 AND payment_punctuality <= 100),
  purchase_frequency INTEGER NOT NULL CHECK (purchase_frequency >= 0 AND purchase_frequency <= 100),
  total_purchases INTEGER NOT NULL CHECK (total_purchases >= 0),
  client_tenure_days INTEGER NOT NULL CHECK (client_tenure_days >= 0),
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on rating for filtering and sorting
CREATE INDEX idx_client_ratings_rating ON client_ratings(rating);

-- Create index on score for sorting
CREATE INDEX idx_client_ratings_score ON client_ratings(score DESC);

-- Create index on last_calculated for cache invalidation queries
CREATE INDEX idx_client_ratings_last_calculated ON client_ratings(last_calculated);

-- Add comment to table
COMMENT ON TABLE client_ratings IS 'Stores calculated client ratings based on payment behavior, purchase frequency, and tenure';

-- Add comments to columns
COMMENT ON COLUMN client_ratings.client_id IS 'Reference to the client (primary key)';
COMMENT ON COLUMN client_ratings.rating IS 'Rating category: A (90-100), B (70-89), C (50-69), D (0-49)';
COMMENT ON COLUMN client_ratings.score IS 'Overall rating score from 0 to 100';
COMMENT ON COLUMN client_ratings.payment_punctuality IS 'Payment punctuality component score (0-100), weighted 40%';
COMMENT ON COLUMN client_ratings.purchase_frequency IS 'Purchase frequency component score (0-100), weighted 30%';
COMMENT ON COLUMN client_ratings.total_purchases IS 'Total number of purchases made by the client';
COMMENT ON COLUMN client_ratings.client_tenure_days IS 'Number of days since the client''s first purchase';
COMMENT ON COLUMN client_ratings.last_calculated IS 'Timestamp when the rating was last calculated';
