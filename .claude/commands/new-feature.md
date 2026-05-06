# /new-feature — Agregar una nueva funcionalidad al ERP

Guía para implementar una feature nueva siguiendo la arquitectura del proyecto.

## Uso
`/new-feature [descripción de la funcionalidad]`

Ejemplo: `/new-feature Agregar exportación de clientes a Excel desde la página de clientes`

## Proceso

### 1. Planificar antes de escribir código
- Describir qué páginas/componentes se crean o modifican
- Identificar si necesita:
  - Nueva ruta → `app/(auth)/[ruta]/page.tsx`
  - Nuevo componente → `components/[sección]/[nombre].tsx`
  - Nueva API route → `app/api/[ruta]/route.ts`
  - Nuevo Server Action → `actions/[nombre].ts`
  - Migración SQL → `supabase/migrations/YYYYMMDDHHMMSS_[nombre].sql`

### 2. Crear migraciones SQL (si aplica)
- Archivo en `supabase/migrations/`
- Siempre usar `IF NOT EXISTS`, `OR REPLACE`, `CREATE INDEX IF NOT EXISTS`
- Timezone: `AT TIME ZONE 'America/Lima'` en funciones con fechas
- Avisar al usuario que debe ejecutar en Supabase Dashboard → SQL Editor
- URL: https://supabase.com/dashboard/project/mwdqdrqlzlffmfqqcnmp/sql/new

### 3. Implementar el backend

**API Route** (`app/api/[ruta]/route.ts`):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ... lógica
}
```

**Server Action** (`actions/[nombre].ts`):
```ts
'use server'
import { createServerClient } from '@/lib/supabase/server'

export async function myAction(data: MyInput): Promise<{ success: boolean; data?: T; error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }
  // ... lógica
}
```

### 4. Implementar el frontend

**Página RSC** (`app/(auth)/[ruta]/page.tsx`):
- `import { createServerClient } from '@/lib/supabase/server'` para datos iniciales
- Pasar datos como props al componente cliente

**Componente cliente** (`components/[sección]/`):
- `'use client'` al inicio
- Usar `createBrowserClient` si necesita queries adicionales
- Dark mode: solo tokens semánticos (`bg-card`, `text-foreground`, `border-border`)
- Formularios: React Hook Form + Zod (con `zod-compat.ts` para uuid/email)

### 5. Agregar al sidebar (si es nueva página)
- Editar `components/shared/sidebar.tsx`
- Agregar al grupo apropiado en el array `groups`
- Respetar la estructura `{ title, href, icon }`

### 6. Verificar y deployar
- Revisar que no hay errores de TypeScript obvios
- Ejecutar `/deploy` para subir a producción

## Checklist de calidad antes de hacer PR/commit
- [ ] Auth gate en API routes
- [ ] Zod v4 compatible (sin .uuid()/.email()/.datetime())
- [ ] Dark mode con tokens semánticos
- [ ] Timezone Lima en fechas
- [ ] Server Action retorna `{ success, data?, error? }`
- [ ] Errores manejados con try/catch y toast.error()
- [ ] Store filtering (si aplica) — filtrar por MUJERES/HOMBRES/ALL
