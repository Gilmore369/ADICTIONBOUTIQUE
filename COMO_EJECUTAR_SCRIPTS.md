# Cómo Ejecutar los Scripts SQL

## ⚠️ Errores Comunes y Soluciones

### Error 1: "syntax error at or near $"
**Causa:** Versión antigua del script con `DO $` en lugar de `DO $$`

**Solución:** Los scripts ya están corregidos. Asegúrate de usar las versiones actuales:
- `FIX_CREDIT_AND_COORDINATES.sql` ✅ Corregido
- `SEED_FINAL.sql` ✅ Corregido

### Error 2: "violates foreign key constraint stock_product_id_fkey"
**Causa:** Intentar borrar productos que tienen stock

**Solución:** El script `SEED_FINAL.sql` ya borra el stock ANTES de borrar productos:
```sql
DELETE FROM stock WHERE stock.product_id IN (SELECT id FROM products WHERE barcode LIKE 'PROD-%');
DELETE FROM products WHERE barcode LIKE 'PROD-%';
```

Si aún tienes el error, ejecuta manualmente:
```sql
-- Borrar stock primero
DELETE FROM stock WHERE stock.product_id IN (SELECT id FROM products WHERE barcode LIKE 'PROD-%');

-- Luego borrar productos
DELETE FROM products WHERE barcode LIKE 'PROD-%';
```

### Error 3: "column reference product_id is ambiguous"
**Causa:** Hay una variable declarada con el mismo nombre que la columna

**Solución:** Ya está corregido en el script. Usa `stock.product_id` en lugar de solo `product_id`

### Error 4: "violates foreign key constraint movements_product_id_fkey"
**Causa:** Intentar borrar productos que tienen movimientos de inventario

**Solución:** El script `SEED_FINAL.sql` ya borra los movimientos ANTES de borrar productos:
```sql
DELETE FROM movements m USING products p WHERE m.product_id = p.id AND p.barcode LIKE 'PROD-%';
DELETE FROM products WHERE barcode LIKE 'PROD-%';
```

## 📋 Orden de Ejecución

### Opción A: Corregir Datos Existentes

Si ya tienes datos y solo quieres corregir el formato y coordenadas:

```sql
-- 1. Ejecuta este script en Supabase SQL Editor
-- Archivo: supabase/FIX_CREDIT_AND_COORDINATES.sql
```

Este script:
- ✅ Recalcula `credit_used` basado en cuotas pendientes
- ✅ Agrega coordenadas a clientes sin coordenadas
- ✅ No borra ningún dato existente

### Opción B: Empezar con Datos Frescos

Si quieres empezar de cero con datos de prueba:

```sql
-- 1. Ejecuta este script en Supabase SQL Editor
-- Archivo: supabase/SEED_FINAL.sql
```

Este script:
- ⚠️ BORRA datos existentes (clientes con teléfono 555-*, productos PROD-*)
- ✅ Crea 50 clientes CON coordenadas de Trujillo
- ✅ Crea 100 productos
- ✅ Genera 3 meses de datos (Dic 2025 - Feb 2026)
- ✅ Incluye ventas, pagos, cuotas, turnos de caja

## 🔍 Verificar que el Script Funcionó

### Después de FIX_CREDIT_AND_COORDINATES.sql

Ejecuta estas consultas para verificar:

```sql
-- Ver clientes con coordenadas
SELECT 
  name, 
  credit_used, 
  lat, 
  lng
FROM clients
WHERE lat IS NOT NULL
LIMIT 10;

-- Ver resumen de deuda
SELECT 
  COUNT(*) as clientes_con_deuda,
  SUM(credit_used) as deuda_total,
  AVG(credit_used) as deuda_promedio
FROM clients
WHERE credit_used > 0;
```

### Después de SEED_FINAL.sql

El script muestra automáticamente un resumen al final:
- Número de clientes, productos, ventas, etc.
- Ventas por mes y tienda

También puedes ejecutar:

```sql
-- Ver clientes con coordenadas
SELECT COUNT(*) FROM clients WHERE lat IS NOT NULL;

-- Ver ventas por tienda
SELECT 
  store_id,
  COUNT(*) as num_ventas,
  SUM(total) as total_ventas
FROM sales
GROUP BY store_id;
```

## 🗺️ Probar el Mapa

Después de ejecutar cualquiera de los scripts:

1. Ve a `/map` en tu aplicación
2. Deberías ver clientes en el mapa de Trujillo
3. Prueba los filtros:
   - **Atrasados** - Clientes con pagos vencidos
   - **Próximos a Vencer** - Cuotas en los próximos 7 días
   - **Al Día** - Clientes sin atrasos
   - **Todos con Crédito** - Todos los clientes con deuda

## 💡 Tips

### Si el mapa no muestra clientes:

1. Verifica que los clientes tienen coordenadas:
```sql
SELECT COUNT(*) FROM clients WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

2. Verifica que los clientes tienen deuda (para aparecer en el mapa):
```sql
SELECT COUNT(*) FROM clients WHERE credit_used > 0;
```

3. Verifica que tienes la API key de Google Maps configurada:
```bash
# En .env.local
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

### Si el formato de moneda no se ve bien:

1. Limpia la caché del navegador (Ctrl+Shift+R)
2. Verifica que los componentes importan `formatCurrency`:
```typescript
import { formatCurrency } from '@/lib/utils/currency'
```

## 📞 Soporte

Si encuentras otros errores:
1. Copia el mensaje de error completo
2. Indica qué script estabas ejecutando
3. Indica si es la primera vez o si ya habías ejecutado scripts antes
