# 🚨 Prueba Manual Urgente - Sistema Completo

## ⚠️ Playwright MCP No Conectado
No puedo usar Playwright automáticamente. Necesitas probar manualmente.

---

## 🎯 PRUEBAS CRÍTICAS (5 minutos)

### 1. Historial de Ventas (2 min)
```
URL: http://localhost:3000/sales
```

**Verificar:**
- [ ] Página carga sin errores
- [ ] Dashboard muestra 4 cards con números
- [ ] Tabla muestra ventas
- [ ] Botón "PDF" funciona en cada venta
- [ ] Filtros funcionan

**Si falla:**
- Abrir consola del navegador (F12)
- Copiar el error completo
- Reportar el error

---

### 2. Devoluciones (2 min)
```
URL: http://localhost:3000/returns
```

**Verificar:**
- [ ] Página carga sin errores
- [ ] Dashboard muestra 4 cards
- [ ] Botón "Nueva Devolución" aparece
- [ ] Tabla aparece (puede estar vacía)

**Si falla:**
- Abrir consola del navegador (F12)
- Copiar el error completo
- Reportar el error

---

### 3. Lista Negra (1 min)
```
URL: http://localhost:3000/clients/blacklist
```

**Verificar:**
- [ ] Página carga sin errores
- [ ] Dashboard aparece
- [ ] Botón "Agregar a Lista Negra" aparece
- [ ] Tabla aparece (puede estar vacía)

**Si falla:**
- Abrir consola del navegador (F12)
- Copiar el error completo
- Reportar el error

---

## 🔍 ERRORES COMUNES Y SOLUCIONES

### Error: "relation returns does not exist"
**Causa:** La tabla returns no se creó en Supabase
**Solución:**
1. Ir a Supabase Dashboard → SQL Editor
2. Ejecutar: `supabase/DIAGNOSTICO_RETURNS.sql`
3. Ver qué falta
4. Reportar resultado

### Error: "function generate_return_number does not exist"
**Causa:** Las funciones no se crearon
**Solución:**
1. Ejecutar solo la parte de funciones del script
2. Ver `supabase/FIX_RETURNS_MIGRATION.sql` líneas 50-100

### Error: "Cannot read properties of undefined"
**Causa:** Datos no están llegando desde Supabase
**Solución:**
1. Verificar que las políticas RLS están activas
2. Verificar que el usuario está autenticado
3. Revisar consola del navegador

---

## 📊 SCRIPT DE VERIFICACIÓN RÁPIDA

Ejecuta esto en Supabase SQL Editor:

```sql
-- Verificación rápida
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns')
    THEN '✅ Tabla returns existe'
    ELSE '❌ Tabla returns NO existe - EJECUTAR FIX_RETURNS_MIGRATION.sql'
  END AS estado;

-- Si la tabla existe, verificar funciones
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_return_number')
    THEN '✅ Función generate_return_number existe'
    ELSE '❌ Función NO existe - EJECUTAR FIX_RETURNS_MIGRATION.sql'
  END AS funcion1;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_return_eligibility')
    THEN '✅ Función check_return_eligibility existe'
    ELSE '❌ Función NO existe - EJECUTAR FIX_RETURNS_MIGRATION.sql'
  END AS funcion2;

-- Verificar políticas RLS
SELECT COUNT(*) || ' políticas RLS' AS rls_count
FROM pg_policies 
WHERE tablename = 'returns';
```

---

## 🎯 REPORTE DE ESTADO

Después de probar, reporta:

1. **¿Qué páginas cargan?**
   - [ ] /sales
   - [ ] /returns
   - [ ] /clients/blacklist

2. **¿Qué errores ves en consola?**
   - Copiar errores completos

3. **¿Qué dice el script de verificación SQL?**
   - Copiar resultado completo

---

## 🚀 ACCIÓN INMEDIATA

1. Abrir http://localhost:3000/returns
2. Abrir consola (F12)
3. Ver si hay errores
4. Reportar qué ves

---

## 📞 INFORMACIÓN PARA REPORTAR

Si algo no funciona, necesito saber:

1. **URL que falla:** (ej: /returns)
2. **Error en consola:** (copiar completo)
3. **Resultado de DIAGNOSTICO_RETURNS.sql:** (copiar completo)
4. **¿La migración se ejecutó?** (sí/no)
5. **¿Qué mensaje apareció al ejecutar?** (copiar)

---

**TIEMPO ESTIMADO:** 5 minutos
**PRIORIDAD:** ALTA
**ACCIÓN:** Probar las 3 URLs y reportar estado
