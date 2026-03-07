# 🔧 Solución al Error de Migración de Returns

## ❌ Error Encontrado

```
Error: Failed to run sql query: ERROR: 42P07: relation "idx_returns_sale_id" already exists
```

Este error indica que la migración se ejecutó parcialmente y algunos objetos ya existen en la base de datos.

---

## ✅ Solución

### Opción 1: Ejecutar Script de Corrección (RECOMENDADO)

Este script limpia los objetos existentes y los recrea correctamente.

**Archivo:** `supabase/FIX_RETURNS_MIGRATION.sql`

**Pasos:**
1. Ir a Supabase Dashboard
2. Abrir SQL Editor
3. Copiar el contenido completo de `supabase/FIX_RETURNS_MIGRATION.sql`
4. Pegar en el editor
5. Hacer clic en "Run"
6. Verificar que aparece: "Migración de returns completada exitosamente"

---

### Opción 2: Limpiar y Ejecutar Migración Original

Si prefieres empezar desde cero:

**Paso 1: Limpiar objetos existentes**
```sql
-- Ejecutar: supabase/CLEANUP_RETURNS_TABLE.sql
-- ADVERTENCIA: Esto eliminará todos los datos de devoluciones existentes
```

**Paso 2: Ejecutar migración corregida**
```sql
-- Ejecutar: supabase/migrations/20260307000000_create_returns_table.sql
-- (Ya está corregida con IF NOT EXISTS)
```

---

## 📋 Verificación

Después de ejecutar el script, verifica que todo está correcto:

```sql
-- 1. Verificar que la tabla existe
SELECT COUNT(*) FROM returns;

-- 2. Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'returns';

-- 3. Verificar funciones
SELECT proname FROM pg_proc WHERE proname IN ('generate_return_number', 'check_return_eligibility');

-- 4. Verificar políticas RLS
SELECT policyname FROM pg_policies WHERE tablename = 'returns';

-- 5. Probar generación de número
SELECT generate_return_number();
```

**Resultado esperado:**
- Tabla `returns` existe
- 7 índices creados
- 2 funciones creadas
- 4 políticas RLS activas
- Función genera: `DEV-0001`

---

## 🎯 Próximos Pasos

Una vez ejecutado el script correctamente:

1. ✅ Migración de returns completada
2. ⏳ Ejecutar migración de blacklist (si no se ha hecho)
3. ⏳ Probar sistema de devoluciones en la aplicación

---

## 🧪 Prueba Rápida

Después de ejecutar el script, prueba crear una devolución:

1. Ir a http://localhost:3000/returns
2. Hacer clic en "Nueva Devolución"
3. Si aparece el diálogo, la migración fue exitosa ✅

---

## 📞 Soporte

Si el error persiste:

1. Verificar que tienes permisos de administrador en Supabase
2. Revisar el log completo del error en Supabase
3. Ejecutar el script de verificación arriba
4. Reportar el error específico

---

## 📁 Archivos Relacionados

- `supabase/FIX_RETURNS_MIGRATION.sql` - Script de corrección (USAR ESTE)
- `supabase/CLEANUP_RETURNS_TABLE.sql` - Script de limpieza
- `supabase/migrations/20260307000000_create_returns_table.sql` - Migración original (corregida)

---

**Estado:** ✅ SOLUCIÓN LISTA  
**Tiempo estimado:** 2 minutos  
**Acción:** Ejecutar `FIX_RETURNS_MIGRATION.sql` en Supabase SQL Editor
