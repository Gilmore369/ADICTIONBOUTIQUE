# /db-check — Verificar estado de la base de datos Supabase

Consulta el estado real de Supabase vía REST API para verificar tablas, columnas, funciones y datos.

## Credenciales
```
SUPA=https://mwdqdrqlzlffmfqqcnmp.supabase.co
SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo
```

## Uso
`/db-check` — verificación general
`/db-check migrations` — verificar migraciones aplicadas
`/db-check [tabla]` — inspeccionar una tabla específica (ej: `/db-check clients`)

## Qué verificar según el argumento

### Sin argumento — health check general
Consulta estas tablas y muestra recuento de filas:
- `sales` (ventas totales + voided)
- `clients` (activos / inactivos)
- `installments` (PENDING/PARTIAL/OVERDUE/PAID/VOIDED)
- `payments` (registros de cobro)
- `stock` (registros de inventario)
- `returns` (devoluciones por estado)

### `migrations` — verificar que todas las migraciones están aplicadas
Comprueba:
1. Columna `voided` en `sales` → `GET /rest/v1/sales?select=voided&limit=1`
2. Columna `idempotency_key` en `payments` → `GET /rest/v1/payments?select=idempotency_key&limit=1`
3. RPC `get_dashboard_metrics` → `POST /rest/v1/rpc/get_dashboard_metrics` con `{"p_inactivity_days":90}`
4. RPC `increment_stock` → intenta llamarlo con product_id dummy, espera FK error (no "function not found")
5. RPC `peek_sale_number_seq` → debe retornar un número
6. RPC `generate_return_number` → debe retornar string tipo "DEV-XXXX"
7. Tabla `returns` → `GET /rest/v1/returns?select=id&limit=1`
8. Status VOIDED en installments → intenta INSERT con status VOIDED, espera FK error (no CHECK error)
9. MENSAJE_REDES en collection_actions → intenta INSERT, espera FK error (no CHECK error)

### `[nombre de tabla]` — inspeccionar tabla
Muestra las primeras 5 filas de la tabla especificada con todos los campos.

## Formato de salida
Presenta los resultados como tabla con ✅ / ❌ / ⚠️ por cada check.
Si hay errores, mostrar el mensaje exacto de Supabase.
