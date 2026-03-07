# Acciones para Completar la Línea de Perfumes

## Problema Identificado

La línea "Perfumes" existe en la base de datos pero **NO aparece en los selectores** de:
- Categorías
- Ingreso Masivo
- Otros módulos que filtran por línea

## Causa

La línea "Perfumes" probablemente tiene el campo `active = false` en la base de datos, por lo que los selectores que filtran por `active = true` no la muestran.

## Solución

### Paso 1: Ejecutar el Script SQL

Abre Supabase SQL Editor y ejecuta el archivo: `supabase/FIX_PERFUMES_LINE.sql`

Este script hará:
1. ✅ Activar la línea de Perfumes (`active = true`)
2. ✅ Crear 3 categorías para Perfumes:
   - Fragancias Hombre
   - Fragancias Mujer
   - Fragancias Unisex
3. ✅ Crear tallas apropiadas para cada categoría:
   - 30ml, 50ml, 100ml, 150ml (para Hombre y Mujer)
   - 30ml, 50ml, 100ml, 150ml, 200ml (para Unisex)

### Paso 2: Verificar en la Aplicación

Después de ejecutar el script, refresca la página y verifica:

1. **En Categorías** (`/catalogs/categories`):
   - El filtro "Filtrar por Línea" debe mostrar "Perfumes"
   - Al crear nueva categoría, el selector de línea debe incluir "Perfumes"

2. **En Tallas** (`/catalogs/sizes`):
   - Deben aparecer las tallas creadas (30ml, 50ml, 100ml, 150ml, 200ml)
   - Asociadas a las categorías de Fragancias

3. **En Ingreso Masivo** (`/inventory/bulk-entry`):
   - El selector de Línea debe incluir "Perfumes"
   - Al seleccionar Perfumes, deben aparecer las categorías de Fragancias
   - Al seleccionar una categoría, deben aparecer las tallas en ml

## Estructura Creada

```
Perfumes (Línea)
├── Fragancias Hombre (Categoría)
│   ├── 30ml
│   ├── 50ml
│   ├── 100ml
│   └── 150ml
├── Fragancias Mujer (Categoría)
│   ├── 30ml
│   ├── 50ml
│   ├── 100ml
│   └── 150ml
└── Fragancias Unisex (Categoría)
    ├── 30ml
    ├── 50ml
    ├── 100ml
    ├── 150ml
    └── 200ml
```

## Alternativa: Activar Manualmente

Si prefieres hacerlo desde la interfaz:

1. **Revisar el código del formulario de edición de líneas**:
   - El componente `components/catalogs/line-form.tsx` no tiene un checkbox de "activo"
   - Esto significa que todas las líneas se crean como activas por defecto
   - El problema es que "Perfumes" se creó con `active = false`

2. **Solución rápida en SQL**:
   ```sql
   UPDATE lines SET active = true WHERE name = 'Perfumes';
   ```

3. **Luego crear categorías y tallas manualmente** desde la interfaz

## Recomendación

**Ejecuta el script SQL** - Es más rápido y garantiza que todo quede correctamente configurado con las tallas apropiadas para perfumes (en mililitros).
