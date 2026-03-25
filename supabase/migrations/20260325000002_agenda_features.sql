-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Agenda Features
-- Adds: agenda_reminders + agenda_scheduled_visits
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Recordatorios personales ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agenda_reminders (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  date         DATE        NOT NULL,
  note         TEXT,
  color        TEXT        NOT NULL DEFAULT 'purple',
    -- purple | blue | green | orange | red
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_date    ON public.agenda_reminders(date);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.agenda_reminders(user_id);

ALTER TABLE public.agenda_reminders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.agenda_reminders TO authenticated;
GRANT ALL ON public.agenda_reminders TO service_role;

-- ── 2. Visitas programadas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agenda_scheduled_visits (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL DEFAULT 'Visita de cobranza',
  scheduled_date DATE        NOT NULL,
  visit_type     TEXT        NOT NULL DEFAULT 'Cobranza',
    -- Cobranza | Activación | Seguimiento | Prospección
  note           TEXT,
  client_ids     UUID[]      NOT NULL DEFAULT '{}',
  status         TEXT        NOT NULL DEFAULT 'pending',
    -- pending | completed | cancelled
  user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_visit_type CHECK (visit_type IN (
    'Cobranza', 'Activación', 'Seguimiento', 'Prospección'
  )),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_sched_visits_date    ON public.agenda_scheduled_visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sched_visits_user_id ON public.agenda_scheduled_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_visits_status  ON public.agenda_scheduled_visits(status);

ALTER TABLE public.agenda_scheduled_visits DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.agenda_scheduled_visits TO authenticated;
GRANT ALL ON public.agenda_scheduled_visits TO service_role;

COMMENT ON TABLE public.agenda_reminders IS
  'Personal reminders shown in the agenda calendar';
COMMENT ON TABLE public.agenda_scheduled_visits IS
  'Planned field visits with one or more clients — shown in agenda and linkable to the map';
