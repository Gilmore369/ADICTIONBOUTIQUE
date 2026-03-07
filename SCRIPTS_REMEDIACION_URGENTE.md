# SCRIPTS DE REMEDIACIÓN URGENTE
## Comandos listos para ejecutar - Fase 1 Crítica

**⚠️ IMPORTANTE:** Ejecutar estos scripts en orden. Hacer backup antes de cualquier cambio.

---

## 1. ROTAR CLAVES EXPUESTAS (CRÍTICO)

### 1.1. Remover .env.local del historial de Git

```bash
# ⚠️ ADVERTENCIA: Esto reescribe el historial de Git
# Asegúrate de que todo el equipo esté informado

# Backup del repositorio actual
git clone . ../backup-repo

# Remover .env.local del historial completo
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Limpiar referencias
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Forzar push (CUIDADO: reescribe historial remoto)
git push origin --force --all
git push origin --force --tags
```

### 1.2. Crear .env.example (template sin valores reales)

```bash
cat > .env.example << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Google Maps API (for Map Module)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here

# Resend Email API
RESEND_API_KEY=your_resend_key_here
RESEND_FROM_EMAIL=your_email_here

# Gmail Configuration (Alternative to Resend)
GMAIL_USER=your_gmail_here
GMAIL_PASSWORD=your_app_password_here
EOF

git add .env.example
git commit -m "Add .env.example template"
git push
```

### 1.3. Actualizar .gitignore

```bash
cat >> .gitignore << 'EOF'

# Environment variables (NEVER commit these)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
!.env.example
EOF

git add .gitignore
git commit -m "Update .gitignore to exclude all .env files"
git push
```

### 1.4. Rotar claves en servicios

```markdown
## Supabase (Dashboard)
1. Ir a: https://supabase.com/dashboard/project/mwdqdrqlzlffmfqqcnmp/settings/api
2. Click en "Reset" para anon key
3. Click en "Reset" para service_role key
4. Copiar nuevas claves a .env.local (NO commitear)

## Google Maps API (Google Cloud Console)
1. Ir a: https://console.cloud.google.com/apis/credentials
2. Encontrar la API key actual
3. Click en "Regenerate key"
4. Copiar nueva clave a .env.local

## Resend (Dashboard)
1. Ir a: https://resend.com/api-keys
2. Revocar clave actual
3. Crear nueva clave
4. Copiar nueva clave a .env.local

## Gmail (Google Account)
1. Ir a: https://myaccount.google.com/apppasswords
2. Revocar contraseña de aplicación actual
3. Generar nueva contraseña de aplicación
4. Copiar nueva contraseña a .env.local
```

---

## 2. HABILITAR RLS EN SUPABASE (CRÍTICO)

### 2.1. Ejecutar migración RLS

```sql
-- Ejecutar en Supabase SQL Editor
-- Dashboard → SQL Editor → New Query

-- ============================================================================
-- RE-HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock               ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_actions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config       ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREAR FUNCIONES HELPER PARA RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND 'admin' = ANY(roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role_name = ANY(roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- EJECUTAR MIGRACIÓN COMPLETA
-- ============================================================================
\i supabase/migrations/20260223000006_proper_rls_with_jwt.sql
```

### 2.2. Verificar que RLS está habilitado

```sql
-- Verificar estado de RLS en todas las tablas
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'audit_log', 'lines', 'categories', 'brands', 
    'sizes', 'suppliers', 'products', 'stock', 'movements',
    'clients', 'sales', 'sale_items', 'credit_plans', 
    'installments', 'payments', 'collection_actions',
    'cash_shifts', 'cash_expenses', 'stores', 'warehouses'
  )
ORDER BY tablename;

-- ✅ Resultado esperado: rls_enabled = true para todas las tablas
```

### 2.3. Probar RLS con diferentes roles

```sql
-- Probar como usuario sin roles (debería fallar)
SET request.jwt.claims.sub = 'test-user-id';
SELECT * FROM products LIMIT 1;
-- Esperado: 0 rows (sin permisos)

-- Probar como admin (debería funcionar)
-- (Requiere usuario real con rol admin en la tabla users)
```

---

## 3. AGREGAR VALIDACIÓN DE AUTORIZACIÓN EN APIs (CRÍTICO)

### 3.1. Actualizar app/api/client-actions/route.ts

```bash
# Crear backup
cp app/api/client-actions/route.ts app/api/client-actions/route.ts.backup

# Aplicar fix
cat > app/api/client-actions/route.ts << 'EOF'
/**
 * Client Actions API Route
 * 
 * POST /api/client-actions - Create a new client action log
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireCRMAccess } from '@/lib/auth/authorization'
import { ActionType } from '@/lib/types/crm'

export async function POST(request: NextRequest) {
  try {
    // ✅ Verificar autorización (admin, vendedor, cobrador)
    const { userId } = await requireCRMAccess()
    const supabase = await createServerClient()

    const body = await request.json()
    const { clientId, action_type, description } = body

    // Validate required fields
    if (!clientId || !action_type || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate action type
    const validActionTypes = Object.values(ActionType)
    if (!validActionTypes.includes(action_type)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      )
    }

    // Create action log
    const { data: actionLog, error: insertError } = await supabase
      .from('client_action_logs')
      .insert({
        client_id: clientId,
        action_type,
        description,
        user_id: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating action log:', insertError)
      return NextResponse.json(
        { error: 'Failed to create action log' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: actionLog })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
EOF
```

### 3.2. Actualizar app/api/collection-actions/route.ts

```bash
# Crear backup
cp app/api/collection-actions/route.ts app/api/collection-actions/route.ts.backup

# Aplicar fix
cat > app/api/collection-actions/route.ts << 'EOF'
/**
 * Collection Actions API Route
 * 
 * POST /api/collection-actions - Create a new collection action
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireRole, Role } from '@/lib/auth/authorization'

export async function POST(request: NextRequest) {
  try {
    // ✅ Solo admin y cobrador pueden crear acciones de cobranza
    const { userId } = await requireRole([Role.ADMIN, Role.COBRADOR])
    const supabase = await createServerClient()

    const body = await request.json()
    const { clientId, action_type, result, description, follow_up_date } = body

    // Validate required fields
    if (!clientId || !action_type || !result || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get client name
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Create collection action
    const { data: collectionAction, error: insertError } = await supabase
      .from('collection_actions')
      .insert({
        client_id: clientId,
        client_name: client.name,
        action_type,
        result,
        notes: description,
        payment_promise_date: follow_up_date || null,
        user_id: userId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating collection action:', insertError)
      return NextResponse.json(
        { error: 'Failed to create collection action' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: collectionAction })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
EOF
```

---

## 4. CORREGIR CONFIGURACIÓN DE NEXT.JS (CRÍTICO)

### 4.1. Actualizar next.config.ts

```bash
# Crear backup
cp next.config.ts next.config.ts.backup

# Aplicar fix
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    // ✅ Habilitar verificación de tipos en build
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'mwdqdrqlzlffmfqqcnmp.supabase.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
EOF
```

### 4.2. Generar tipos de Supabase

```bash
# Instalar CLI de Supabase (si no está instalado)
npm install -g supabase

# Generar tipos
npx supabase gen types typescript --project-id mwdqdrqlzlffmfqqcnmp > types/database.ts

# Verificar que se generó correctamente
ls -lh types/database.ts
```

### 4.3. Corregir errores de tipo

```bash
# Ejecutar verificación de tipos
npm run build

# Si hay errores, corregirlos uno por uno
# Ejemplo de errores comunes:
# - Property 'X' does not exist on type 'Y'
# - Type 'X' is not assignable to type 'Y'
# - Argument of type 'X' is not assignable to parameter of type 'Y'
```

---

## 5. VERIFICACIÓN FINAL

### 5.1. Checklist de verificación

```bash
# ✅ Verificar que .env.local no está en Git
git ls-files | grep .env.local
# Esperado: sin resultados

# ✅ Verificar que .env.example existe
ls -la .env.example
# Esperado: archivo existe

# ✅ Verificar que build funciona
npm run build
# Esperado: build exitoso sin errores

# ✅ Verificar que la app funciona
npm run dev
# Esperado: servidor inicia correctamente
```

### 5.2. Pruebas de seguridad básicas

```bash
# Probar autenticación
curl -X POST http://localhost:3000/api/client-actions \
  -H "Content-Type: application/json" \
  -d '{"clientId":"test","action_type":"LLAMADA","description":"test"}'
# Esperado: 401 Unauthorized

# Probar con usuario autenticado (requiere token válido)
# ...
```

---

## 6. COMMIT Y DEPLOY

```bash
# Commit de cambios
git add .
git commit -m "Security fixes: Enable RLS, add authorization checks, fix Next.js config"
git push

# Deploy a staging primero
# (Comando depende de tu plataforma: Vercel, AWS, etc.)

# Verificar en staging
# ...

# Deploy a producción
# ...
```

---

## NOTAS IMPORTANTES

⚠️ **ANTES DE EJECUTAR:**
1. Hacer backup completo de la base de datos
2. Informar al equipo sobre cambios en Git
3. Coordinar con DevOps para deploy
4. Tener plan de rollback listo

⚠️ **DESPUÉS DE EJECUTAR:**
1. Verificar que la app funciona correctamente
2. Monitorear logs por 24 horas
3. Verificar que RLS no bloquea operaciones legítimas
4. Documentar cualquier issue encontrado

---

## CONTACTO DE EMERGENCIA

Si algo sale mal durante la ejecución:
1. Revertir cambios: `git revert HEAD`
2. Restaurar backup de base de datos
3. Contactar al equipo de DevOps
4. Revisar logs de error

