# Adiction Boutique Suite - Supabase Migration

Sistema de gestión empresarial completo migrado de Google Apps Script + Google Sheets a Next.js 14 + Supabase + TypeScript.

## 🚀 Stack Tecnológico

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5+
- **Backend:** Next.js Server Actions, API Routes
- **Database:** Supabase (PostgreSQL 15+)
- **Auth:** Supabase Auth con JWT y RLS
- **UI:** TailwindCSS 3+, shadcn/ui
- **Validación:** Zod, React Hook Form
- **Estado:** React Query (TanStack Query)
- **Mapas:** Google Maps JavaScript API

## 📦 Módulos Implementados

### 1. Catálogos
- Gestión de líneas, categorías, marcas, tallas, proveedores
- Catálogo de productos con búsqueda debounced (300ms)
- Gestión de clientes con geolocalización
- CRUD completo con validación Zod

### 2. POS (Punto de Venta)
- Ventas al contado y a crédito
- Búsqueda de productos con debounce + LIMIT 50
- Carrito de compras con cálculo en tiempo real
- Validación de stock y límite de crédito
- Transacciones atómicas con rollback

### 3. Deuda
- Planes de crédito con 1-6 cuotas
- Cuotas con fechas +30 días
- Marcado automático de cuotas vencidas
- Visualización de estado de deuda

### 4. Cobranzas
- Registro de pagos con algoritmo oldest_due_first
- Aplicación automática a cuotas vencidas primero
- Manejo de pagos parciales y completos
- Acciones de cobranza (llamadas, visitas, WhatsApp)
- Reprogramación de cuotas

### 5. Mapa
- Visualización geográfica de clientes
- Marcadores con código de colores (rojo/amarillo/verde)
- Filtros por estado de deuda
- Planificación de rutas de cobranza

## 🏗️ Estructura del Proyecto

```
supa/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Rutas autenticadas
│   │   ├── catalogs/        # Módulo Catálogos
│   │   ├── pos/             # Módulo POS
│   │   ├── debt/            # Módulo Deuda
│   │   ├── collections/     # Módulo Cobranzas
│   │   ├── map/             # Módulo Mapa
│   │   └── layout.tsx       # Layout con sidebar
│   ├── (public)/            # Rutas públicas
│   │   └── login/           # Página de login
│   └── api/                 # API Routes
│       ├── products/search/
│       ├── clients/search/
│       └── installments/
├── components/              # Componentes React
│   ├── ui/                  # shadcn/ui base
│   ├── catalogs/            # Componentes de catálogos
│   ├── pos/                 # Componentes de POS
│   ├── debt/                # Componentes de deuda
│   ├── collections/         # Componentes de cobranzas
│   ├── map/                 # Componentes de mapa
│   └── shared/              # Componentes compartidos
├── actions/                 # Server Actions
│   ├── catalogs.ts
│   ├── sales.ts
│   ├── payments.ts
│   └── auth.ts
├── lib/                     # Utilidades
│   ├── supabase/            # Clientes Supabase
│   ├── validations/         # Esquemas Zod
│   ├── auth/                # RBAC y permisos
│   └── payments/            # Algoritmo oldest_due_first
├── hooks/                   # Custom hooks
│   ├── use-debounce.ts
│   └── use-cart.ts
├── types/                   # TypeScript types
│   └── database.ts
└── supabase/                # Migraciones SQL
    └── migrations/
        ├── 20240101000000_initial_schema.sql
        ├── 20240101000001_create_indexes.sql
        ├── 20240101000002_atomic_functions.sql
        └── 20240101000003_row_level_security.sql
```

## 🔧 Configuración

### 1. Variables de Entorno

Crear `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 2. Instalación

```bash
cd supa
npm install
```

### 3. Base de Datos

```bash
# Ejecutar migraciones
npx supabase db push

# O manualmente en Supabase Dashboard > SQL Editor
# Ejecutar en orden:
# 1. 20240101000000_initial_schema.sql
# 2. 20240101000001_create_indexes.sql
# 3. 20240101000002_atomic_functions.sql
# 4. 20240101000003_row_level_security.sql
```

### 4. Desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## 🎨 Sistema de Diseño

### Tokens de Diseño

**Espaciado (base 8px):**
- 4px, 8px, 12px, 16px, 24px, 32px

**Border Radius:**
- Estándar: 8px
- Pills/Badges: 999px

**Componentes:**
- Button height: 36px
- Button padding: 12px × 16px
- Card padding: 16px
- Card border: 1px solid

**Tipografía:**
- H1: 20-24px
- H2: 16-18px
- Body: 14-16px

**Estrategia de Profundidad:**
- Solo bordes (no sombras pesadas)

## ⚡ Optimizaciones de Performance

### Reglas Críticas

✅ **NO bulk loading** - UI carga sin esperar datos (Suspense)
✅ **Búsquedas debounced** - 300ms delay + LIMIT 50
✅ **Cache con React Query** - staleTime configurado
✅ **Operaciones atómicas** - Funciones de base de datos
✅ **Validación de fechas** - Sin undefined/Invalid Date
✅ **Invalidación de cache** - revalidatePath en mutaciones

### Patrones de Acceso a Datos

```typescript
// ✅ BUENO - Lazy loading con Suspense
<Suspense fallback={<TableSkeleton />}>
  <ProductsData />
</Suspense>

// ✅ BUENO - Búsqueda debounced
const debouncedSearch = useDebounce(search, 300)

// ✅ BUENO - LIMIT forzado
const limit = Math.min(Math.max(requestedLimit, 1), 50)
```

## 🔐 Autenticación y Autorización

### Roles

- **Admin:** Acceso completo
- **Vendedor:** Productos, ventas, clientes, reportes
- **Cajero:** Ventas, caja
- **Cobrador:** Clientes, pagos, cobranzas, reportes

### RLS (Row Level Security)

Todas las tablas tienen políticas RLS:
- Users: Ver perfil propio
- Products: Ver activos, gestionar por rol
- Sales: Ver tiendas propias, anular solo admin
- Clients: Ver todos, gestionar por rol
- Installments: Ver todos, actualizar por rol

## 📊 Base de Datos

### Tablas (19 total)

**Configuración:**
- users, audit_log

**Catálogos:**
- lines, categories, brands, sizes, suppliers, products

**Inventario:**
- stock, movements

**Clientes:**
- clients

**Ventas:**
- sales, sale_items

**Crédito:**
- credit_plans, installments, payments

**Cobranzas:**
- collection_actions

**Caja:**
- cash_shifts, cash_expenses

### Funciones Atómicas

```sql
-- Decrementar stock con bloqueo FOR UPDATE
decrement_stock(warehouse_id, product_id, quantity)

-- Incrementar crédito usado
increment_credit_used(client_id, amount)

-- Decrementar crédito usado
decrement_credit_used(client_id, amount)

-- Crear venta completa (transacción atómica)
create_sale_transaction(...)
```

### Índices

```sql
-- Full-text search con gin_trgm_ops
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_clients_name ON clients USING gin(to_tsvector('spanish', name));

-- Lookups
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_clients_dni ON clients(dni);
CREATE INDEX idx_installments_due_date ON installments(due_date);
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🚢 Deployment

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Variables de Entorno en Vercel

Configurar en Vercel Dashboard > Settings > Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## 📝 Algoritmos Clave

### oldest_due_first (Cobranzas)

Algoritmo de aplicación de pagos que prioriza:
1. Cuotas vencidas (due_date < hoy)
2. Cuotas próximas (due_date >= hoy)
3. Dentro de cada grupo, ordena por due_date ascendente

```typescript
// Aplicar pago de S/ 250 a cuotas
const result = applyPaymentToInstallments(250, installments)
// result.updatedInstallments: cuotas actualizadas
// result.remainingAmount: monto sobrante (si hay)
```

### Validación de Fechas

Todas las fechas usan formato ISO y se validan:

```typescript
// Zod schema
z.string().datetime('Invalid date format')

// Validación adicional
const date = new Date(dateString)
if (isNaN(date.getTime())) {
  throw new Error('Invalid date')
}
```

## 🔄 Migración de Datos

Script de migración desde Google Sheets:

```bash
# Ejecutar migración
npm run migrate:sheets
```

El script:
1. Lee datos de Google Sheets (batch con getValues)
2. Transforma datos al esquema PostgreSQL
3. Valida integridad
4. Inserta en Supabase (batch)
5. Verifica conteo de filas
6. Registra en audit_log

## 📚 Documentación Adicional

- [API Documentation](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Migration Guide](./docs/MIGRATION.md)
- [Business Logic](./docs/BUSINESS_LOGIC.md)

## 🤝 Contribución

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Propietario: Adiction Boutique

## 👥 Equipo

Desarrollado para Adiction Boutique Suite

---

**Versión:** 1.0.0  
**Última actualización:** 2024
