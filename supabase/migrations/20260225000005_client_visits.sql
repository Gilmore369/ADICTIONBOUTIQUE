-- Migration: Client Visits (Gestión de Visitas)
-- Tracks field visits made to clients for cobranza, activación, seguimiento, etc.

CREATE TABLE IF NOT EXISTS public.client_visits (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  visit_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_type   TEXT        NOT NULL DEFAULT 'Cobranza',
    -- Cobranza | Activación | Seguimiento | Prospección
  result       TEXT        NOT NULL,
    -- Pagó | Abono parcial | Prometió pagar | No estaba | Rechazó | Interesado | Dejé recado | Sin respuesta
  comment      TEXT,
  image_url    TEXT,       -- Optional photo (Supabase Storage URL)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_visit_type CHECK (visit_type IN (
    'Cobranza', 'Activación', 'Seguimiento', 'Prospección'
  )),
  CONSTRAINT chk_result CHECK (result IN (
    'Pagó', 'Abono parcial', 'Prometió pagar',
    'No estaba', 'Rechazó', 'Interesado',
    'Dejé recado', 'Sin respuesta'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visits_client_id  ON public.client_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON public.client_visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_user_id    ON public.client_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_result     ON public.client_visits(result);

-- RLS (disabled, consistent with project pattern)
ALTER TABLE public.client_visits DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.client_visits TO authenticated;
GRANT ALL ON public.client_visits TO service_role;

COMMENT ON TABLE public.client_visits IS
  'Field visits to clients — cobranza, activación, seguimiento, prospección';
COMMENT ON COLUMN public.client_visits.result IS
  'Outcome of the visit: Pagó, Abono parcial, Prometió pagar, No estaba, Rechazó, Interesado, Dejé recado, Sin respuesta';
COMMENT ON COLUMN public.client_visits.image_url IS
  'Optional photo proof stored in Supabase Storage bucket "visit-images"';
