# Funcionalidades Pendientes - Sistema POS

## 1. HISTORIAL DE VENTAS

### Descripción
Página para ver todas las ventas realizadas con opciones de filtrado, búsqueda y descarga de tickets en PDF.

### Ubicación Sugerida
- Ruta: `/sales` o `/ventas`
- Menú: Agregar en el sidebar entre "POS" y "Caja"

### Funcionalidades Requeridas

#### Vista Principal
- Tabla con todas las ventas ordenadas por fecha (más reciente primero)
- Columnas:
  - Número de Ticket (V-0001, V-0002, etc.)
  - Fecha y Hora
  - Cliente (si es venta a crédito)
  - Tipo de Pago (CONTADO/CRÉDITO)
  - Total
  - Tienda
  - Acciones (Ver detalles, Descargar PDF)

#### Filtros
- Por rango de fechas (Hoy, Esta semana, Este mes, Personalizado)
- Por tipo de pago (Todos, CONTADO, CRÉDITO)
- Por tienda (Todas, Tienda Mujeres, Tienda Hombres)
- Por cliente (búsqueda por nombre)
- Por número de ticket

#### Acciones
- **Descargar PDF**: Botón para descargar el ticket en PDF con el nombre `Ticket_V-XXXX.pdf`
- **Ver Detalles**: Modal o página con información completa de la venta
  - Productos vendidos
  - Cantidades
  - Precios
  - Descuentos
  - Plan de cuotas (si aplica)
- **Exportar**: Exportar lista de ventas a CSV/Excel

#### Estadísticas Rápidas (Cards superiores)
- Total de ventas del día
- Total de ventas del mes
- Ventas al contado vs crédito
- Ticket promedio

### Archivos a Crear
```
app/(auth)/sales/
  ├── page.tsx                    # Página principal de historial
  └── [id]/
      └── page.tsx                # Página de detalle de venta

components/sales/
  ├── sales-table.tsx             # Tabla de ventas
  ├── sales-filters.tsx           # Filtros de búsqueda
  ├── sale-detail-modal.tsx       # Modal de detalle
  └── sales-stats.tsx             # Cards de estadísticas

actions/sales.ts                  # Agregar función getSales()
```

### API Endpoints Necesarios
- `GET /api/sales` - Listar ventas con filtros
- `GET /api/sales/[id]` - Obtener detalle de una venta
- `POST /api/sales/generate-pdf` - Ya existe ✅

---

## 2. GESTIÓN DE LISTA NEGRA

### Descripción
Interfaz para administrar clientes en lista negra (bloqueados para ventas a crédito).

### Ubicación Sugerida
- Opción 1: Pestaña dentro de `/clients` (Clientes)
- Opción 2: Página separada `/clients/blacklist`

### Funcionalidades Requeridas

#### Vista de Lista Negra
- Tabla con clientes en lista negra
- Columnas:
  - Nombre del cliente
  - DNI
  - Fecha de ingreso a lista negra
  - Motivo (deuda vencida, días de atraso)
  - Deuda pendiente
  - Acciones (Ver perfil, Quitar de lista negra)

#### Filtros
- Por días de atraso (>10 días, >30 días, >60 días)
- Por monto de deuda
- Búsqueda por nombre o DNI

#### Acciones
- **Agregar a Lista Negra**: Botón manual para agregar un cliente
  - Modal con selección de cliente
  - Campo de motivo/observaciones
- **Quitar de Lista Negra**: Botón para remover un cliente
  - Confirmación con advertencia
  - Registro de quién y cuándo lo removió
- **Ver Perfil**: Link al perfil completo del cliente

#### Automatización (Ya implementada)
- Los clientes con deuda vencida >10 días se agregan automáticamente
- Se actualiza al registrar pagos

### Integración con Sistema Actual

#### En Página de Clientes (`/clients`)
- Agregar pestaña "Lista Negra" junto a la tabla principal
- Mostrar badge rojo en clientes que están en lista negra
- Filtro rápido "Solo lista negra"

#### En POS (`/pos`)
- Ya implementado ✅: Muestra advertencia cuando se selecciona cliente en lista negra
- Ya implementado ✅: Bloquea venta a crédito para clientes en lista negra

### Archivos a Modificar/Crear
```
app/(auth)/clients/
  └── page.tsx                    # Agregar pestaña de lista negra

components/clients/
  ├── blacklist-table.tsx         # Tabla de lista negra (NUEVO)
  ├── blacklist-filters.tsx       # Filtros (NUEVO)
  ├── add-to-blacklist-dialog.tsx # Modal para agregar (NUEVO)
  └── clients-table.tsx           # Modificar para mostrar badge

actions/clients.ts                # Agregar funciones:
                                  # - getBlacklistedClients()
                                  # - addToBlacklist()
                                  # - removeFromBlacklist()
```

### Base de Datos
La tabla `clients` ya tiene el campo `blacklisted` (boolean) ✅

Campos adicionales sugeridos:
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS blacklisted_reason TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS blacklisted_by UUID REFERENCES auth.users(id);
```

---

## PRIORIDAD DE IMPLEMENTACIÓN

### Alta Prioridad
1. **Historial de Ventas** - Funcionalidad crítica para el negocio
   - Permite revisar ventas pasadas
   - Descargar tickets para clientes
   - Auditoría de ventas

### Media Prioridad
2. **Gestión de Lista Negra** - Mejora la administración
   - La funcionalidad básica ya existe (bloqueo automático)
   - Esta sería la interfaz de administración

---

## ESTIMACIÓN DE DESARROLLO

### Historial de Ventas
- Tiempo estimado: 4-6 horas
- Complejidad: Media
- Componentes: 5-6 archivos nuevos

### Gestión de Lista Negra
- Tiempo estimado: 2-3 horas
- Complejidad: Baja
- Componentes: 3-4 archivos nuevos

---

## NOTAS IMPORTANTES

1. **Permisos**: Ambas funcionalidades deben respetar los permisos del usuario
2. **Filtros por Tienda**: Deben respetar la selección global de tienda
3. **Responsive**: Deben funcionar en móviles y tablets
4. **Performance**: Implementar paginación para listas grandes
5. **Exportación**: Considerar límites de exportación (ej: máximo 1000 registros)

---

## ¿QUIERES QUE IMPLEMENTE ALGUNA DE ESTAS FUNCIONALIDADES?

Puedo crear cualquiera de estas dos funcionalidades. Solo dime cuál prefieres que implemente primero:

1. **Historial de Ventas** - Para ver y descargar tickets
2. **Gestión de Lista Negra** - Para administrar clientes bloqueados

O puedo implementar ambas si lo prefieres.
