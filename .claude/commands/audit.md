# /audit — Auditoría completa del ERP Adiction Boutique

Realiza una auditoría sistemática del proyecto verificando rutas, componentes, APIs y consistencia.

## Uso
`/audit` — auditoría completa
`/audit sidebar` — solo la barra lateral
`/audit routes` — solo las rutas de páginas
`/audit dark` — solo dark mode (buscar colores hardcoded)
`/audit types` — solo compatibilidad Zod v4
`/audit [sección]` — auditar una sección específica (pos, reports, clients, etc.)

## Auditoría completa (sin argumento)

### 1. Rutas — Verificar que cada href del sidebar tiene su page.tsx
Leer `components/shared/sidebar.tsx`, extraer todos los `href`, y verificar que existe `app/(auth)/[ruta]/page.tsx` para cada uno.

### 2. Sidebar — isItemActive y grupos
- Verificar que `useSearchParams` está importado
- Verificar que los 8 grupos están presentes: Inicio, Ventas, Clientes y cobranzas, Inventario, Catálogo, Agenda, Reportes, Administración
- Verificar que los links de Reportes usan `?tab=`

### 3. API routes — Auth gate
Buscar todos los archivos en `app/api/**/route.ts` y verificar que tienen `supabase.auth.getUser()` con retorno 401 si no hay usuario. Listar los que NO tienen auth.

### 4. Dark mode — Colores hardcoded
Buscar en `components/**/*.tsx` clases como `bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`, `bg-slate-*` que NO tengan su par `dark:`. Listar las ocurrencias.

### 5. Zod v4 — Incompatibilidades
Buscar en `actions/*.ts` y `app/api/**/*.ts` usos de:
- `z.string().uuid()`
- `z.string().email()`
- `z.string().datetime()`
- `z.string().url()`
Listar cada archivo y línea donde aparezcan.

### 6. Server Actions — Patrón de retorno
Verificar que las acciones en `actions/*.ts` retornan `{ success: boolean }`.

### 7. Timezone — CURRENT_DATE en SQL
Buscar en `supabase/migrations/*.sql` y cualquier RPC inline el uso de `CURRENT_DATE` o `DATE(NOW())` sin `AT TIME ZONE 'America/Lima'`.

## Formato de salida
Para cada sección: encabezado, lista de ✅ OK / ❌ PROBLEMA, y resumen final con conteo de issues.
Si se pasa un argumento específico, solo ejecutar esa sección.
