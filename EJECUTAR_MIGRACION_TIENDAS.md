# Ejecutar Migración de Tiendas

## Paso 1: Ejecutar SQL en Supabase

1. Abre Supabase SQL Editor
2. Copia y pega el contenido de: `supabase/migrations/20260304000000_line_stores_relation.sql`
3. Ejecuta el script
4. Verifica con:

```sql
-- Ver asignaciones
SELECT * FROM v_lines_with_stores ORDER BY line_name, store_name;

-- Resumen por tienda
SELECT 
  s.name as tienda,
  COUNT(ls.line_id) as total_lineas,
  STRING_AGG(l.name, ', ' ORDER BY l.name) as lineas
FROM stores s
LEFT JOIN line_stores ls ON s.id = ls.store_id
LEFT JOIN lines l ON ls.line_id = l.id
GROUP BY s.id, s.name
ORDER BY s.name;
```

**Resultado esperado**:
- Tienda Hombres: 2 líneas (Accesorios, Hombres)
- Tienda Mujeres: 4 líneas (Accesorios, Mujeres, Niños, Perfumes)

## Paso 2: Reiniciar el servidor Next.js

```bash
# Detener el servidor actual (Ctrl+C)
# Reiniciar
npm run dev
```

## Paso 3: Verificar en el navegador

1. Abre http://localhost:3000
2. Inicia sesión
3. Busca el ícono de tienda (🏬) al lado del selector de tema
4. Click en el ícono
5. Deberías ver 3 opciones:
   - 🏬 Todas las Tiendas
   - 👗 Tienda Mujeres
   - 👔 Tienda Hombres

## Paso 4: Validar con Playwright

El selector está visible pero los componentes aún no filtran por tienda.
Necesitamos actualizar los componentes para que usen `useStore()`.
