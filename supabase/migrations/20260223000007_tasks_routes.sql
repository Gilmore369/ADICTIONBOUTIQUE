-- ============================================================================
-- Migration: Tasks & Routes — Cobranzas y Reparto
-- ============================================================================
-- Permite asignar tareas a cobradores/repartidores y crear rutas diarias.
-- MVP: nearest-neighbor desde la app. Fase 2: integración OSRM/Google.
-- ============================================================================

-- ============================================================================
-- 1. TABLA: tasks (tareas asignables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id       UUID REFERENCES stores(id),
  client_id      UUID NOT NULL REFERENCES clients(id),
  task_type      TEXT NOT NULL CHECK (task_type IN ('COBRANZA','ENTREGA','VISITA','OTRO')),
  assigned_to    UUID REFERENCES public.users(id),
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','IN_PROGRESS','DONE','CANCELLED')),
  priority       INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  notes          TEXT,
  -- Referencia opcional a plan de crédito (para COBRANZA)
  plan_id        UUID REFERENCES credit_plans(id) ON DELETE SET NULL,
  -- Referencia opcional a venta (para ENTREGA)
  sale_id        UUID REFERENCES sales(id) ON DELETE SET NULL,
  completed_at   TIMESTAMPTZ,
  created_by     UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to    ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status) WHERE status != 'DONE';
CREATE INDEX IF NOT EXISTS idx_tasks_client_id      ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_store_id       ON tasks(store_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date_status    ON tasks(scheduled_date, status)
  WHERE status IN ('PENDING','IN_PROGRESS');

COMMENT ON TABLE tasks IS
  'Tareas asignadas a cobradores o repartidores: cobranzas, entregas, visitas.';

-- ============================================================================
-- 2. TABLA: routes (ruta del día)
-- ============================================================================
CREATE TABLE IF NOT EXISTS routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_date  DATE NOT NULL,
  assigned_to UUID NOT NULL REFERENCES public.users(id),
  store_id    UUID REFERENCES stores(id),
  status      TEXT NOT NULL DEFAULT 'PLANNED'
                CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  notes       TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_date        ON routes(route_date DESC);
CREATE INDEX IF NOT EXISTS idx_routes_assigned    ON routes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_routes_status      ON routes(status) WHERE status != 'COMPLETED';

COMMENT ON TABLE routes IS
  'Ruta del día con paradas ordenadas. Una ruta pertenece a un usuario (cobrador/repartidor).';

-- ============================================================================
-- 3. TABLA: route_stops (paradas de la ruta)
-- ============================================================================
CREATE TABLE IF NOT EXISTS route_stops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stop_order  INTEGER NOT NULL,
  -- Tiempos estimados/reales
  planned_eta TIMESTAMPTZ,
  actual_eta  TIMESTAMPTZ,
  -- Coordenadas snapshot al momento de crear la ruta
  lat         NUMERIC(10,8),
  lng         NUMERIC(11,8),
  completed   BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (route_id, stop_order),
  UNIQUE (route_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route   ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_task    ON route_stops(task_id);

COMMENT ON TABLE route_stops IS
  'Paradas ordenadas de una ruta. stop_order define el orden de visita sugerido.';

-- ============================================================================
-- 4. FUNCIÓN: create_daily_route
-- ============================================================================
-- Crea una ruta a partir de una lista de task_ids.
-- Ordena las paradas por nearest-neighbor (heurística simple desde primer punto).
CREATE OR REPLACE FUNCTION create_daily_route(
  p_user_id    UUID,
  p_store_id   UUID,
  p_date       DATE,
  p_task_ids   UUID[]
) RETURNS UUID AS $$
DECLARE
  v_route_id    UUID;
  v_task_id     UUID;
  v_order       INTEGER := 1;
  v_current_lat NUMERIC;
  v_current_lng NUMERIC;
  v_nearest_id  UUID;
  v_nearest_dist NUMERIC;
  v_remaining   UUID[];
  v_lat         NUMERIC;
  v_lng         NUMERIC;
  v_dist        NUMERIC;
BEGIN
  -- Crear ruta
  INSERT INTO routes (assigned_to, store_id, route_date)
  VALUES (p_user_id, p_store_id, p_date)
  RETURNING id INTO v_route_id;

  -- Punto de inicio: primer cliente de la lista (o coordenadas de tienda si se quiere)
  SELECT c.lat, c.lng INTO v_current_lat, v_current_lng
  FROM tasks t JOIN clients c ON t.client_id = c.id
  WHERE t.id = p_task_ids[1];

  v_remaining := p_task_ids;

  -- Nearest-neighbor greedy
  WHILE array_length(v_remaining, 1) > 0 LOOP
    v_nearest_id   := NULL;
    v_nearest_dist := 999999;

    FOREACH v_task_id IN ARRAY v_remaining LOOP
      SELECT c.lat, c.lng INTO v_lat, v_lng
      FROM tasks t JOIN clients c ON t.client_id = c.id
      WHERE t.id = v_task_id;

      -- Distancia Euclidiana (suficiente para ordenar, no para navegación real)
      v_dist := SQRT(
        POWER(COALESCE(v_lat,0) - COALESCE(v_current_lat,0), 2) +
        POWER(COALESCE(v_lng,0) - COALESCE(v_current_lng,0), 2)
      );

      IF v_dist < v_nearest_dist THEN
        v_nearest_dist := v_dist;
        v_nearest_id   := v_task_id;
        v_current_lat  := v_lat;
        v_current_lng  := v_lng;
      END IF;
    END LOOP;

    -- Insertar parada
    INSERT INTO route_stops (route_id, task_id, stop_order, lat, lng)
    SELECT v_route_id, v_nearest_id, v_order, c.lat, c.lng
    FROM tasks t JOIN clients c ON t.client_id = c.id
    WHERE t.id = v_nearest_id;

    -- Actualizar tarea como asignada
    UPDATE tasks SET assigned_to = p_user_id WHERE id = v_nearest_id;

    v_remaining := array_remove(v_remaining, v_nearest_id);
    v_order := v_order + 1;
  END LOOP;

  RETURN v_route_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_daily_route TO authenticated;

COMMENT ON FUNCTION create_daily_route IS
  'Crea una ruta diaria y ordena las paradas usando nearest-neighbor greedy. MVP para cobranzas/entregas.';

-- ============================================================================
-- 5. FUNCIÓN: generate_collection_tasks
-- ============================================================================
-- Genera tareas de cobranza automáticamente para clientes con cuotas vencidas.
CREATE OR REPLACE FUNCTION generate_collection_tasks(
  p_store_id     UUID DEFAULT NULL,
  p_assigned_to  UUID DEFAULT NULL,
  p_date         DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
  v_client      RECORD;
  v_count       INTEGER := 0;
BEGIN
  -- Por cada cliente con cuotas vencidas sin tarea activa hoy
  FOR v_client IN
    SELECT DISTINCT
      cp.client_id,
      cp.id AS plan_id,
      s.store_uuid
    FROM installments i
    JOIN credit_plans cp ON i.plan_id = cp.id
    JOIN sales s ON cp.sale_id = s.id
    WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
      AND i.due_date < CURRENT_DATE
      AND cp.status = 'ACTIVE'
      AND (p_store_id IS NULL OR s.store_uuid = p_store_id)
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.client_id = cp.client_id
          AND t.task_type = 'COBRANZA'
          AND t.status IN ('PENDING','IN_PROGRESS')
          AND t.scheduled_date = p_date
      )
  LOOP
    INSERT INTO tasks (
      client_id, task_type, assigned_to,
      scheduled_date, status, priority, plan_id, store_id
    ) VALUES (
      v_client.client_id, 'COBRANZA', p_assigned_to,
      p_date, 'PENDING', 2, v_client.plan_id, v_client.store_uuid
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_collection_tasks TO authenticated;

COMMENT ON FUNCTION generate_collection_tasks IS
  'Genera tareas de COBRANZA para clientes con cuotas vencidas sin tarea activa. Retorna número de tareas creadas.';

-- ============================================================================
-- 6. RLS para tasks, routes, route_stops
-- ============================================================================
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops  ENABLE ROW LEVEL SECURITY;

-- Tasks: todos ven, cobrador/admin gestiona las suyas
CREATE POLICY "tasks_read" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_write" ON tasks
  FOR ALL USING (
    public.has_role('admin') OR
    public.has_role('cobrador') OR
    auth.uid() = assigned_to
  );

-- Routes: propietario ve/gestiona las suyas; admin ve todo
CREATE POLICY "routes_read" ON routes
  FOR SELECT USING (
    auth.uid() = assigned_to OR public.is_admin()
  );

CREATE POLICY "routes_write" ON routes
  FOR ALL USING (
    auth.uid() = assigned_to OR public.is_admin()
  );

-- Route_stops: heredan acceso de routes
CREATE POLICY "route_stops_read" ON route_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = route_stops.route_id
        AND (r.assigned_to = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "route_stops_write" ON route_stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = route_stops.route_id
        AND (r.assigned_to = auth.uid() OR public.is_admin())
    )
  );
