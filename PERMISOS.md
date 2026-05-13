# 🛡️ Sistema de Permisos — Adiction Boutique

Última auditoría: 2026-05-13

## 1. Roles disponibles

El sistema tiene **4 roles**. Un usuario puede tener **uno o varios** (combinables).

| Rol | Para quién | Ejemplo de cargo |
|---|---|---|
| `admin` | Dueño / gerente | Franco, Arizitah |
| `vendedor` | Personal que vende en tienda | Vendedora de turno |
| `cajero` | Personal solo de caja | Cajero de turno |
| `cobrador` | Personal de cobranza en campo | Motorizado, cobrador |

> **Combinables**: un mismo usuario puede tener `["vendedor", "cobrador"]` para vender Y cobrar.

---

## 2. Matriz de permisos por rol (actualizado 2026-05-13)

**Decisión de negocio**: TODOS los roles tienen acceso a TODO el flujo
operativo. Solo se restringen a admin: **gestión de usuarios**, **logs**
y **configuración**.

| Permiso | admin | vendedor | cajero | cobrador |
|---|:---:|:---:|:---:|:---:|
| **VIEW_DASHBOARD** | ✅ | ✅ | ✅ | ✅ |
| **MANAGE_PRODUCTS** (catálogo) | ✅ | ✅ | ✅ | ✅ |
| **CREATE_SALE** (POS) | ✅ | ✅ | ✅ | ✅ |
| **VOID_SALE** (anular ventas) | ✅ | ✅ | ✅ | ✅ |
| **MANAGE_CLIENTS** | ✅ | ✅ | ✅ | ✅ |
| **RECORD_PAYMENT** (cobros) | ✅ | ✅ | ✅ | ✅ |
| **RESCHEDULE_INSTALLMENT** | ✅ | ✅ | ✅ | ✅ |
| **MANAGE_CASH** (caja) | ✅ | ✅ | ✅ | ✅ |
| **VIEW_REPORTS** | ✅ | ✅ | ✅ | ✅ |
| **Importar Deudas Legacy** | ✅ | ✅ | ✅ | ✅ |
| **MANAGE_USERS** (gestionar usuarios) | ✅ | ❌ | ❌ | ❌ |
| **Logs / Auditoría** | ✅ | ❌ | ❌ | ❌ |
| **Configuración del negocio** | ✅ | ❌ | ❌ | ❌ |

---

## 3. Acceso a cada sección de la app

### Dashboard / KPIs
- **Todos los roles** ven el dashboard
- El dashboard se filtra automáticamente por la tienda asignada al usuario

### Catálogo (Productos, Líneas, Categorías, Marcas, Tallas, Proveedores)
- ✅ admin + vendedor
- ❌ cajero + cobrador → **no ven la sección**

### Inventario (Stock, Movimientos, Carga masiva)
- ✅ admin + vendedor
- ❌ cajero + cobrador

### Punto de venta (POS)
- ✅ admin + vendedor + cajero
- ❌ cobrador

### Ventas realizadas / Historial
- ✅ admin + vendedor + cajero
- ❌ cobrador

### Devoluciones
- ✅ admin + vendedor
- ❌ cajero + cobrador

### Caja diaria
- ✅ admin + cajero
- ❌ vendedor + cobrador

### Clientes / CRM / Lista negra
- ✅ admin + vendedor + cobrador
- ❌ cajero

### Cobranzas (Mapa, Deudas, Pagos, Acciones)
- ✅ admin + vendedor + cobrador
- ❌ cajero

### Reportes
- ✅ admin + vendedor + cobrador
- ❌ cajero

### Administración (👁️ solo admin ve esta sección en el sidebar)
- 🔒 **Usuarios** — gestión RBAC
- 🔒 **Importar Deudas** — migración masiva legacy
- 🔒 **Logs/Auditoría** — historial de cambios
- 🔒 **Configuración** — datos del negocio

---

## 4. Filtrado por tienda

Cada usuario tiene una propiedad `stores: string[]` que define a qué tiendas puede acceder.

| stores del usuario | Comportamiento |
|---|---|
| `["MUJERES", "HOMBRES"]` | Ve ambas tiendas, puede cambiar de tienda con el selector |
| `["MUJERES"]` | Solo ve datos de Tienda Mujeres (bloqueado, no puede cambiar) |
| `["HOMBRES"]` | Solo ve datos de Tienda Hombres (bloqueado, no puede cambiar) |

**Importante**: si un cliente compró en ambas tiendas y el usuario solo tiene 1 tienda, solo verá las ventas/deudas de su tienda asignada.

---

## 5. Crear usuarios — cómo configurarlos

### Para un **vendedor** de Tienda Mujeres
```
Nombre:   Lucía Pérez
Email:    lucia@adiction.com
Roles:    ["vendedor"]
Stores:   ["MUJERES"]
```
Verá: dashboard, catálogo, inventario, POS, ventas, devoluciones, clientes, cobranzas, reportes. NO verá administración ni caja.

### Para un **cajero** de Tienda Hombres
```
Nombre:   Carlos Mendoza
Email:    carlos@adiction.com
Roles:    ["cajero"]
Stores:   ["HOMBRES"]
```
Verá: dashboard, POS, ventas, caja diaria. NO verá catálogo, clientes, cobranzas, reportes, administración.

### Para un **cobrador** que trabaja ambas tiendas
```
Nombre:   Diego Salazar
Email:    diego@adiction.com
Roles:    ["cobrador"]
Stores:   ["MUJERES", "HOMBRES"]
```
Verá: dashboard, clientes, mapa, cobranzas, reportes. NO verá POS, catálogo, caja, administración.

### Para un **vendedor + cajero combinado** (boutique pequeña con 1 persona)
```
Nombre:   Sofía García
Email:    sofia@adiction.com
Roles:    ["vendedor", "cajero"]
Stores:   ["MUJERES"]
```
Suma de permisos: catálogo + POS + caja + clientes + cobranzas + reportes (todo menos administración).

---

## 6. Cómo se aplican los permisos (3 capas)

```
┌─────────────────────────────────────────────────────┐
│ CAPA 1: Sidebar (UI)                                │
│ Oculta secciones según rol. El cobrador NO ve POS  │
│ siquiera como opción.                               │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ CAPA 2: Server Actions (backend)                    │
│ Cada acción llama checkPermission(REQUIRED_PERM).   │
│ Si no tiene el permiso: { success: false,           │
│ error: 'Forbidden: Insufficient permissions' }      │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ CAPA 3: Postgres RLS (base de datos)                │
│ Aunque alguien bypass las dos capas anteriores      │
│ con un curl directo a Supabase, las políticas RLS  │
│ bloquean inserts/updates de usuarios sin rol.      │
│                                                     │
│ Ej: categories_manage solo permite                  │
│     'admin' = ANY(roles) OR 'vendedor' = ANY(roles) │
└─────────────────────────────────────────────────────┘
```

---

## 7. ⚠️ Bug encontrado y arreglado (2026-05-13)

**Síntoma del usuario**: "intenté crear una categoría y no se creó"

**Causa**: el formulario `<CategoryForm>` usa el componente `Select` de shadcn/ui, que NO submitea su valor automáticamente con el form (a diferencia de `<select>` nativo). Había un hidden `<input>` que solo se renderizaba SI `lineId` tenía valor.

Si el usuario olvidaba elegir línea:
- FormData NO incluía `line_id`
- Zod validaba con `line_id: z.string().min(1)` → fallaba silenciosamente
- Toast aparecía brevemente con "Line is required" pero el usuario lo perdía

**Fix aplicado**:
1. El hidden input ahora SIEMPRE se renderiza (con string vacío si no hay selección) — permite que el server action devuelva el error correcto
2. Mensaje INLINE rojo bajo el dropdown si no hay línea seleccionada
3. Borde rojo en el dropdown como feedback visual
4. Mensaje cuando NO hay líneas en BD: "No hay líneas. Crea una primero."

---

## 8. Donde se definen los permisos en el código

| Concepto | Archivo |
|---|---|
| Roles + Permission enum | `lib/auth/permissions.ts` |
| Map rol → permisos | `lib/auth/permissions.ts` (`ROLE_PERMISSIONS`) |
| Función `checkPermission()` | `lib/auth/check-permission.ts` |
| Sidebar oculta secciones | `components/shared/sidebar.tsx` (campo `adminOnly`) |
| Server actions chequean | Todos los archivos en `actions/*.ts` |
| RLS policies en BD | `supabase/migrations/20240101000003_row_level_security.sql` |
| Normalización roles → lowercase | `supabase/migrations/20260404000001_normalize_user_roles_lowercase.sql` |

---

## 9. Cambiar permisos de un rol (si necesitas ajustar después)

Editar `lib/auth/permissions.ts`:

```ts
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.VENDEDOR]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_PRODUCTS,
    Permission.CREATE_SALE,
    Permission.MANAGE_CLIENTS,
    Permission.RECORD_PAYMENT,
    Permission.VIEW_REPORTS,
    // ← Agregar/quitar permisos aquí
  ],
  ...
}
```

Tras editar:
1. `npm run build`
2. Deploy a VPS
3. Los usuarios verán el cambio en su próximo login (o al refrescar localStorage)

**Si quieres cambiar UI del sidebar** (ej: ocultar otra sección): editar `components/shared/sidebar.tsx`.

**Si quieres cambiar RLS** (capa BD): crear nueva migración SQL y ejecutar en Supabase Dashboard.
