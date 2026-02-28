# 🚨 Solución Rápida: Productos Separados en Catálogo

## Problema

Agregaste un nuevo color pero aparece como un producto separado en el catálogo visual:

```
❌ ACTUAL:
┌─────────────────────┐  ┌─────────────────────┐
│ JEA-0004            │  │ JEA-0033            │
│ Pantalón jean Denim │  │ Pantalón jean Denim │
│ Beige - 20 uds      │  │ Verde - 8 uds       │
└─────────────────────┘  └─────────────────────┘
```

```
✅ ESPERADO:
┌─────────────────────────────┐
│ JEA-0004                    │
│ Pantalón jean Denim         │
│ 🟤 Beige  🟢 Verde          │
│ 28 uds total                │
└─────────────────────────────┘
```

---

## Causa

El nuevo color se creó con un `base_code` diferente (JEA-0033) en lugar de usar el mismo código del modelo original (JEA-0004).

---

## Solución Inmediata

### Opción 1: Corregir en Base de Datos (Recomendado)

1. Abre Supabase Dashboard → SQL Editor
2. Ejecuta este script:

```sql
BEGIN;

-- Cambiar JEA-0033 a JEA-0004
UPDATE products
SET base_code = 'JEA-0004'
WHERE base_code = 'JEA-0033'
  AND base_name = 'Pantalón jean Denim';

-- Verificar
SELECT 
  base_code,
  STRING_AGG(DISTINCT color, ', ') as colores,
  COUNT(*) as variantes
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code;

COMMIT;
```

3. Refresca el catálogo visual (F5)
4. Ahora ambos colores aparecerán juntos

### Opción 2: Usar Script Genérico

Si tienes varios modelos con este problema:

1. Ejecuta: `supabase/UNIFICAR_BASE_CODE.sql`
2. Sigue las instrucciones en el script
3. Cambia las variables según tu caso

---

## Prevención Futura

Para evitar este problema al agregar nuevos colores:

### ✅ Flujo Correcto:

1. **Buscar el modelo existente**
   - Ve a Inventario → Ingreso Masivo
   - Selecciona el proveedor
   - Busca "Pantalón jean Denim"
   - Haz clic en el resultado

2. **Verificar que cargó correctamente**
   - Debe mostrar: `base_code: JEA-0004`
   - Debe aparecer banner amarillo: "📦 Agregando nuevo color al modelo existente"
   - Campo de color debe estar VACÍO

3. **Ingresar el nuevo color**
   - Escribe el nuevo color (ej: "Verde")
   - NO cambies la categoría
   - NO cambies otros campos

4. **Seleccionar tallas y guardar**
   - Selecciona las tallas
   - Ingresa cantidades
   - Guarda

### ❌ Errores Comunes:

1. **No buscar el modelo existente**
   - Resultado: Se crea con nuevo código

2. **Cambiar la categoría después de cargar**
   - Resultado: Se genera nuevo código

3. **Crear modelo nuevo en lugar de buscar**
   - Resultado: Se crea con nuevo código

---

## Scripts Disponibles

### 1. `supabase/DIAGNOSTICO_COLORES.sql`
- Ver qué productos tienen el problema
- Identificar base_code duplicados

### 2. `supabase/FIX_BASE_CODE_COLORES.sql`
- Corrección específica para "Pantalón jean Denim"
- Cambia JEA-0033 → JEA-0004

### 3. `supabase/UNIFICAR_BASE_CODE.sql`
- Script genérico para cualquier modelo
- Incluye diagnóstico y corrección

---

## Verificación

Después de ejecutar la corrección:

### En Supabase:

```sql
SELECT 
  base_code,
  base_name,
  STRING_AGG(DISTINCT color, ', ') as colores,
  COUNT(*) as variantes
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code, base_name;
```

**Resultado esperado:**
```
base_code | base_name            | colores      | variantes
----------|---------------------|--------------|----------
JEA-0004  | Pantalón jean Denim | Beige, Verde | 8
```

### En Catálogo Visual:

1. Refresca la página (F5)
2. Busca "Pantalón jean Denim"
3. Debe aparecer UNA sola tarjeta
4. Con DOS círculos de color (Beige y Verde)
5. Con todas las tallas disponibles

---

## Resumen

1. ✅ **Ejecuta**: `supabase/FIX_BASE_CODE_COLORES.sql`
2. ✅ **Refresca**: El catálogo visual (F5)
3. ✅ **Verifica**: Ambos colores en la misma tarjeta
4. ✅ **Previene**: Usa el flujo correcto para futuros colores

---

## Contacto

Si el problema persiste:
1. Ejecuta `DIAGNOSTICO_COLORES.sql`
2. Comparte los resultados
3. Verificaremos qué más puede estar pasando
