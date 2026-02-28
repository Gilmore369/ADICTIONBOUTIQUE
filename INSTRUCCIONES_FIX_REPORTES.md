# Instrucciones para Corregir los Reportes

## Problema
Los reportes no se generan y aparecen errores como:
- `Could not find the function public.report_inventory_rotation`
- `column "sd.total_sold" must appear in the GROUP BY clause`

## Solución

### Paso 1: Abrir Supabase Dashboard
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en "SQL Editor"

### Paso 2: Ejecutar el Script de Corrección
1. Abre el archivo `supabase/EJECUTAR_FIX_REPORTES.sql` en tu editor
2. Copia TODO el contenido del archivo (Ctrl+A, Ctrl+C)
3. En el SQL Editor de Supabase, pega el contenido (Ctrl+V)
4. Haz clic en el botón "Run" (o presiona Ctrl+Enter)
5. Espera a que termine la ejecución (puede tomar 10-30 segundos)

### Paso 3: Verificar que no haya errores
- Si todo salió bien, verás un mensaje de éxito
- Si hay errores, copia el mensaje de error y compártelo

### Paso 4: Probar los Reportes
1. Recarga tu aplicación (F5)
2. Ve a la página de Reportes
3. Intenta generar cualquier reporte
4. Debería funcionar correctamente

## ¿Qué hace el script?

El script realiza 3 acciones principales:

1. **Corrige errores de SQL**: Arregla problemas de GROUP BY en las funciones de analytics
2. **Crea funciones wrapper**: Crea funciones en el schema `public` que llaman a las funciones de `analytics`
3. **Otorga permisos**: Da permisos de ejecución a usuarios autenticados

## Si aún hay problemas

Si después de ejecutar el script siguen apareciendo errores:

1. Verifica que el script se ejecutó completamente sin errores
2. Recarga la página de la aplicación (F5)
3. Limpia la caché del navegador (Ctrl+Shift+R)
4. Si el problema persiste, comparte el mensaje de error exacto

## Archivos relacionados

- `supabase/EJECUTAR_FIX_REPORTES.sql` - Script principal de corrección
- `supabase/FIX_ANALYTICS_WRAPPERS.sql` - Solo wrappers (no usar, usar el principal)
- `supabase/FIX_ANALYTICS_SQL_ERRORS.sql` - Solo correcciones SQL (no usar, usar el principal)
