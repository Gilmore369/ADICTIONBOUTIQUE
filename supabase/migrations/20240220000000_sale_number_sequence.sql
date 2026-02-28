-- Migration: Sale Number Sequence
-- Description: Creates sequence and function for human-friendly sale numbers (V-0001, V-0002, etc.)
-- Date: 2026-02-20

-- Create sequence for sale numbers
CREATE SEQUENCE IF NOT EXISTS sale_number_seq START WITH 1;

-- Function to generate next sale number with format V-NNNN
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  sale_num TEXT;
BEGIN
  -- Get next sequence value
  next_num := nextval('sale_number_seq');
  
  -- Format as V-0001, V-0002, etc. (4 digits with leading zeros)
  sale_num := 'V-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN sale_num;
END;
$$;

COMMENT ON FUNCTION generate_sale_number() IS 'Generates human-friendly sale numbers like V-0001, V-0002';
COMMENT ON SEQUENCE sale_number_seq IS 'Sequence for generating correlative sale numbers';
