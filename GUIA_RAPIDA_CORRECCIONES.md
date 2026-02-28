# Guía Rápida: Aplicar Correcciones

## 🚀 Inicio Rápido (3 pasos)

### Paso 1: Ejecutar Correcciones
```bash
# Opción A: Script maestro (recomendado)
psql -h <tu-host> -U postgres -d postgres -f supabase/EJECUTAR_TODAS_LAS_CORRECCIONES.sql

# Opción B: Desde Supabase Dashboard
# 1. Ir a SQL Editor
# 2. Copiar contenido de EJECUTAR_TODAS_LAS_CORRECCIONES.sql
# 3. Ejecutar
```

### Paso 2: Verificar Resultados
```bash
psql -h <tu-host> -U postgres -d postgres -f supabase/VERIFICAR_CORRECCIONES.sql
```

### Paso 3: Probar en la UI
- Ir a `/clients` - verificar que no hay créditos negativos
- Ir a `/map` - verificar que aparecen clientes
- Registrar un pago de prueba
- Crear una venta a crédito de prueba

---

## 📁 Archivos Importantes

### Scripts SQL (ejecutar en orden)
1. `EJECUTAR_TODAS_LAS_CORRECCIONES.sql` - Script maestro
2. `VERIFICAR_CORRECCIONES.sql` - Verificación

### Documentación
1. `RESUMEN_CORRECCIONES.md` - Resumen en español
2. `FIXES_CREDIT_AND_MAP.md` - Documentación técnica completa

---

## ✅ Checklist de Verificación

### En la Base de Datos
- [ ] Función `recalculate_client_credit_used` creada
- [ ] Trigger `trigger_installment_update_credit_used` creado
- [ ] Todos los clientes tienen `credit_used` recalculado
- [ ] Todos los clientes tienen coordenadas (lat/lng)
- [ ] No hay créditos disponibles negativos

### En la Interfaz
- [ ] `/clients` - No muestra créditos negativos
- [ ] `/clients` - Formato S/ con separadores de miles
- [ ] `/clients` - "Deuda Pendiente" en lugar de "Crédito Usado"
- [ ] `/map` - Muestra clientes en el mapa
- [ ] `/map` - Filtros funcionan correctamente
- [ ] Registro de pago decrementa `credit_used`
- [ ] Venta a crédito incrementa `credit_used`

---

## 🔧 Solución de Problemas

### Problema: "Function does not exist"
```sql
-- Verificar que la función existe
SELECT proname FROM pg_proc WHERE proname = 'recalculate_client_credit_used';

-- Si no existe, ejecutar:
\i supabase/migrations/20240224000000_fix_credit_used_logic.sql
```

### Problema: "Clientes con crédito negativo"
```sql
-- Recalcular manualmente
SELECT recalculate_client_credit_used(id) FROM clients;
```

### Problema: "Clientes no aparecen en el mapa"
```sql
-- Verificar coordenadas
SELECT COUNT(*) FROM clients WHERE lat IS NULL OR lng IS NULL;

-- Si hay clientes sin coordenadas, ejecutar:
\i supabase/FIX_CLIENT_COORDINATES.sql
```

### Problema: "credit_used no se actualiza con pagos"
```sql
-- Verificar que el trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_installment_update_credit_used';

-- Si no existe, ejecutar:
\i supabase/migrations/20240224000000_fix_credit_used_logic.sql
```

---

## 📊 Queries Útiles

### Ver estado de un cliente específico
```sql
SELECT 
  c.name,
  c.credit_limit,
  c.credit_used,
  c.credit_limit - c.credit_used AS disponible,
  COALESCE(SUM(i.amount - i.paid_amount), 0) AS deuda_calculada
FROM clients c
LEFT JOIN credit_plans cp ON cp.client_id = c.id
LEFT JOIN installments i ON i.plan_id = cp.id 
  AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
WHERE c.name ILIKE '%nombre%'
GROUP BY c.id, c.name, c.credit_limit, c.credit_used;
```

### Recalcular un cliente específico
```sql
SELECT recalculate_client_credit_used('client-uuid-aqui');
```

### Ver clientes en el mapa
```sql
SELECT name, address, lat, lng, credit_used
FROM clients
WHERE lat IS NOT NULL AND lng IS NOT NULL
  AND credit_used > 0
ORDER BY credit_used DESC
LIMIT 10;
```

---

## 🎯 Qué Cambió

### Antes ❌
- `credit_used` = Total histórico
- Crédito disponible podía ser negativo
- Pagos no decrementaban correctamente
- Clientes sin coordenadas no aparecían

### Después ✅
- `credit_used` = Deuda pendiente actual
- Crédito disponible siempre >= 0
- Pagos actualizan automáticamente
- Todos los clientes tienen coordenadas

---

## 📞 Soporte

Si algo no funciona:
1. Ejecutar `VERIFICAR_CORRECCIONES.sql`
2. Revisar el output para identificar el problema
3. Consultar `RESUMEN_CORRECCIONES.md` para más detalles
4. Revisar `FIXES_CREDIT_AND_MAP.md` para documentación técnica

---

## ⚡ Comandos Rápidos

```bash
# Ejecutar todo
psql -h <host> -U postgres -d postgres -f supabase/EJECUTAR_TODAS_LAS_CORRECCIONES.sql

# Verificar
psql -h <host> -U postgres -d postgres -f supabase/VERIFICAR_CORRECCIONES.sql

# Solo recalcular credit_used
psql -h <host> -U postgres -d postgres -f supabase/FIX_CREDIT_USED.sql

# Solo coordenadas
psql -h <host> -U postgres -d postgres -f supabase/FIX_CLIENT_COORDINATES.sql
```

---

## 🎉 ¡Listo!

Una vez ejecutados los scripts y verificado que todo funciona, el sistema estará completamente corregido y listo para usar.
