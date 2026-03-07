# Sistema de Devoluciones

## Resumen

Sistema completo de gestión de devoluciones con:
- Período de 7 días para devoluciones
- Extensión de 7 días adicionales (previa solicitud y aprobación)
- Tipos: Reembolso o Cambio
- Estados: Pendiente, Aprobada, Rechazada, Completada

## Archivos Creados

### 1. Migración SQL
- `supabase/migrations/20260307000000_create_returns_table.sql`
- Tabla `returns` con todos los campos necesarios
- Función `generate_return_number()` para generar DEV-0001, DEV-0002, etc.
- Función `check_return_eligibility()` para verificar elegibilidad
- Políticas RLS configuradas

### 2. Sidebar Reorganizado
- `components/shared/sidebar.tsx`
- Nueva estructura organizada por secciones:
  * VENTAS: POS, Historial, Devoluciones
  * FINANZAS: Caja, Deuda, Cobranzas
  * CLIENTES: Lista, CRM, Lista Negra, Mapa
  * INVENTARIO: Stock, Movimientos, Ingreso Masivo
  * CATÁLOGOS: Productos, Visual, Líneas, etc.
  * REPORTES

## Próximos Pasos

1. **Ejecutar migración SQL** en Supabase
2. **Crear página de devoluciones** (`app/(auth)/returns/page.tsx`)
3. **Crear componente de gestión** (`components/returns/returns-management-view.tsx`)
4. **Crear acciones** (`actions/returns.ts`)
5. **Probar PDF** descargando uno nuevo (no cacheado)

## Reglas de Negocio

- Devolución dentro de 7 días: Automática
- Después de 7 días: Requiere solicitud de extensión
- Extensión aprobada: 7 días adicionales (total 14 días)
- Tipos de devolución: Reembolso o Cambio por otro producto
