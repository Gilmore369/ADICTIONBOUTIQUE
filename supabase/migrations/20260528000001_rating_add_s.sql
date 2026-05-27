-- ============================================================
-- Permite rating='S' (Especial — S/5,000+) en clients.
-- La UI ya lo ofrecía pero la constraint lo rechazaba.
-- ============================================================

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_rating_check;
ALTER TABLE clients ADD CONSTRAINT clients_rating_check
  CHECK (rating IS NULL OR rating IN ('S', 'A', 'B', 'C', 'D', 'E'));
