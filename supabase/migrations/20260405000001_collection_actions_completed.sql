-- ============================================================================
-- FIX: Agregar completed + follow_up_date a collection_actions
-- PROBLEMA: get_dashboard_metrics muestra 7 "cobros pendientes" porque las
--   columnas completed/follow_up_date no existen → usa fallback COUNT(*) = 7
-- SOLUCIÓN: Crear columnas, marcar historial como completed=true
-- ============================================================================

-- 1. Agregar columna completed (default false para nuevas acciones)
ALTER TABLE collection_actions
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

-- 2. Agregar columna follow_up_date (fecha de seguimiento, opcional)
ALTER TABLE collection_actions
  ADD COLUMN IF NOT EXISTS follow_up_date DATE;

-- 3. Marcar todas las acciones existentes como completadas
--    (son acciones históricas registradas, no pendientes de seguimiento)
UPDATE collection_actions
SET completed = true
WHERE completed = false;

-- 4. Verificar resultado
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE completed = false) AS pending,
       COUNT(*) FILTER (WHERE completed = true)  AS done
FROM collection_actions;
