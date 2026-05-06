# /fix — Corregir un bug en el ERP siguiendo los patrones del proyecto

Recibe la descripción del bug y lo corrige respetando TODOS los patrones del proyecto.

## Uso
`/fix [descripción del bug]`

Ejemplo: `/fix En el POS, al seleccionar crédito no muestra el campo de cuotas`

## Proceso

### 1. Entender el bug
- Leer la descripción en `$ARGUMENTS`
- Identificar qué sección/componente está afectado
- Localizar el archivo fuente relevante

### 2. Diagnosticar antes de tocar código
- Leer el archivo afectado completo
- Buscar la causa raíz (no solo el síntoma)
- Si involucra BD: verificar con `/db-check` primero

### 3. Aplicar el fix respetando las reglas del proyecto

**SIEMPRE verificar antes de escribir:**
- [ ] ¿Uso Zod v4? → NO usar `.uuid()`, `.email()`, `.datetime()` — usar `@/lib/validations/zod-compat`
- [ ] ¿Es un componente cliente? → `createBrowserClient`
- [ ] ¿Es RSC/API/Action? → `createServerClient` o `createServiceClient`
- [ ] ¿Hay fechas? → `getTodayPeru()` en JS, `AT TIME ZONE 'America/Lima'` en SQL
- [ ] ¿Hay colores? → tokens semánticos (`bg-card`, `text-foreground`) NO hardcoded
- [ ] ¿Es un Server Action? → retornar `{ success: boolean; data?: T; error?: string }`
- [ ] ¿Es una API route? → verificar `supabase.auth.getUser()` al inicio

### 4. Verificar el fix
- Revisar que el archivo editado compila (buscar errores de TypeScript obvios)
- Si es lógica de BD: testear via curl a Supabase REST API

### 5. Reportar
Mostrar:
- Archivo(s) modificado(s)
- Qué cambió exactamente (diff resumido)
- Por qué era el bug
- Comando para hacer deploy si corresponde

## Bugs comunes y sus fixes rápidos

| Síntoma | Causa probable | Fix |
|---------|---------------|-----|
| "z.string().uuid is not a function" | Zod v4 incompatible | Usar `uuid()` de `zod-compat.ts` |
| Dashboard muestra número incorrecto de mora | Timezone UTC vs Lima | Verificar RPC usa `AT TIME ZONE 'America/Lima'` |
| Logo no aparece en otra cuenta | Guardado solo en localStorage | Usar `createServiceClient` para upsert en `system_config` |
| Caja no se puede cerrar | CHECK constraint en `expected_amount` | Ya dropeado — verificar con `/db-check migrations` |
| Colores blancos en dark mode | Hardcoded `bg-white` | Reemplazar con `bg-card` |
| Error 401 en API route | Sin auth gate | Agregar `getUser()` check al inicio |
| Categorías no filtran por línea | Sin filtro `line_id` | Filtrar por `c.line_id === selectedLineId` |
