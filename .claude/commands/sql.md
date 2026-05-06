# /sql — Crear y verificar migraciones SQL para Supabase

Genera SQL listo para ejecutar en Supabase Dashboard, siguiendo los patrones del proyecto.

## Uso
`/sql [descripción de lo que necesita el SQL]`

Ejemplo: `/sql agregar columna discount_percent a la tabla sales`
Ejemplo: `/sql crear función RPC para obtener ventas del mes actual en Lima`
Ejemplo: `/sql verificar si la tabla expenses tiene columna category`

## Proceso

### Para CREAR SQL nuevo
1. Escribir el SQL completo, idempotente (usa `IF NOT EXISTS`, `OR REPLACE`, `ADD COLUMN IF NOT EXISTS`)
2. Agregar comentario explicando qué hace y por qué
3. Guardar en `supabase/migrations/YYYYMMDDHHMMSS_[nombre].sql`
4. Indicar que debe ejecutarse en: https://supabase.com/dashboard/project/mwdqdrqlzlffmfqqcnmp/sql/new

### Para VERIFICAR estado actual
Verificar via REST API de Supabase:
```bash
SUPA="https://mwdqdrqlzlffmfqqcnmd.supabase.co"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo"
```

## Reglas SQL del proyecto

### Siempre idempotente
```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE OR REPLACE FUNCTION my_func() ...
```

### Timezone — SIEMPRE Lima
```sql
-- ❌ MAL
WHERE DATE(created_at) = CURRENT_DATE

-- ✅ BIEN
WHERE (created_at AT TIME ZONE 'America/Lima')::DATE = 
      (NOW() AT TIME ZONE 'America/Lima')::DATE
```

### SET search_path al inicio de cada bloque
```sql
SET search_path = public, pg_temp;
```

### GRANT para funciones RPC
```sql
GRANT EXECUTE ON FUNCTION public.mi_funcion() TO authenticated;
```

### Patrón de RPC para reportes
```sql
CREATE OR REPLACE FUNCTION public.report_[nombre](
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL,
  p_warehouse  TEXT DEFAULT NULL
)
RETURNS TABLE (
  columna1 TEXT,
  columna2 NUMERIC,
  ...
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'America/Lima')::DATE;
BEGIN
  -- Usar v_today para comparaciones de fecha
  RETURN QUERY
  SELECT ...
  FROM ...
  WHERE (created_at AT TIME ZONE 'America/Lima')::DATE 
        BETWEEN COALESCE(p_start_date, v_today - 30) AND COALESCE(p_end_date, v_today);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_[nombre](DATE, DATE, TEXT) TO authenticated;
```

## Tablas principales del proyecto

| Tabla | Descripción | Columnas clave |
|-------|-------------|----------------|
| `sales` | Ventas | `id, sale_number, client_id, total, sale_type, voided, store_id, created_at` |
| `sale_items` | Ítems de venta | `sale_id, product_id, quantity, unit_price, subtotal` |
| `clients` | Clientes | `id, name, dni, phone, active, blacklisted, rating, credit_limit, credit_used` |
| `credit_plans` | Planes de crédito | `id, sale_id, client_id, total_amount, status(ACTIVE/CANCELLED/COMPLETED)` |
| `installments` | Cuotas | `id, plan_id, amount, paid_amount, due_date, status(PENDING/PARTIAL/PAID/OVERDUE/VOIDED)` |
| `payments` | Pagos recibidos | `id, client_id, installment_id, amount, payment_date, idempotency_key` |
| `products` | Productos | `id, barcode, name, base_code, line_id, category_id, price, purchase_price, active` |
| `stock` | Stock | `warehouse_id, product_id, quantity` |
| `cash_shifts` | Turnos de caja | `id, store_id, status(OPEN/CLOSED), opened_at, closed_at, expected_amount` |
| `cash_expenses` | Gastos de caja | `id, shift_id, amount, category, description` |
| `returns` | Devoluciones | `id, sale_id, client_id, status(PENDIENTE/APROBADA/COMPLETADA/RECHAZADA), total_amount` |
| `collection_actions` | Acciones cobranza | `id, client_id, action_type(LLAMADA/VISITA/WHATSAPP/MENSAJE_REDES/...), result` |
