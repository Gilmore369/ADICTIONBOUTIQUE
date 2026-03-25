# Sistema de Tienda - Diseño Técnico de Corrección Completa

## Overview

Este diseño técnico aborda la corrección sistemática de 43 bugs identificados en el sistema de tienda Adiction Boutique. El sistema es una aplicación Next.js + TypeScript + Supabase que implementa un ecosistema completo de tienda con múltiples módulos interconectados: gestión de productos, clientes, POS, inventario, reportes, caja, catálogos, devoluciones, autenticación y base de datos.

La estrategia de corrección se basa en una arquitectura de capas con validaciones robustas, manejo de concurrencia, integridad de datos y testing exhaustivo para garantizar que cada módulo funcione correctamente tanto de forma independiente como en integración con los demás.

## Glossary

- **Bug_Condition (C)**: Condiciones específicas que desencadenan fallos en cada uno de los 10 módulos del sistema
- **Property (P)**: Comportamiento correcto esperado para cada funcionalidad del sistema de tienda
- **Preservation**: Funcionalidades existentes que deben mantenerse intactas durante las correcciones
- **Atomic Operations**: Operaciones de base de datos que deben ejecutarse completamente o fallar completamente
- **RLS (Row Level Security)**: Sistema de seguridad a nivel de fila en Supabase para control de acceso granular
- **Multi-Store**: Arquitectura que soporta múltiples tiendas con datos aislados por store_id
- **Soft Delete**: Eliminación lógica usando flags active/voided en lugar de DELETE físico
- **Concurrency Control**: Mecanismos para prevenir condiciones de carrera en operaciones simultáneas
- **Data Integrity**: Conjunto de constraints, triggers y validaciones que garantizan consistencia de datos

## Bug Details

### Bug Condition

El sistema presenta fallos sistemáticos en 10 módulos críticos que afectan la operación completa de la tienda. Los bugs se manifiestan cuando se ejecutan operaciones sin validaciones adecuadas, manejo de concurrencia deficiente, y falta de integridad referencial.

**Formal Specification:**
```
FUNCTION isBugCondition(operation)
  INPUT: operation of type SystemOperation
  OUTPUT: boolean
  
  RETURN (operation.module IN ['products', 'clients', 'pos', 'inventory', 'reports', 'cash', 'catalogs', 'returns', 'auth', 'database'])
         AND (operation.hasValidation = false 
              OR operation.hasConcurrencyControl = false 
              OR operation.hasIntegrityChecks = false
              OR operation.hasProperErrorHandling = false)
END FUNCTION
```

### Examples

**Módulo Productos:**
- Crear producto sin validar campos requeridos → datos inconsistentes
- Editar producto con stock existente → referencias desactualizadas
- Eliminar producto con ventas asociadas → violación de integridad

**Módulo POS:**
- Agregar producto al carrito sin validar stock → sobreventa
- Procesar venta con concurrencia → inconsistencias de stock
- Generar PDF con datos faltantes → error en generación

**Módulo Inventario:**
- Consultar stock con inconsistencias entre tablas → datos incorrectos
- Movimientos sin registro completo → pérdida de trazabilidad

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Funcionalidades que actualmente operan correctamente deben mantenerse intactas
- Performance actual en consultas optimizadas debe preservarse
- Integraciones existentes con Supabase, generación de PDFs y emails deben continuar funcionando
- Interfaz de usuario funcional debe mantener su comportamiento actual
- Datos históricos válidos no deben alterarse

**Scope:**
Todas las operaciones que NO involucran los 43 bugs identificados deben permanecer completamente inalteradas. Esto incluye:
- Consultas de solo lectura que funcionan correctamente
- Operaciones de autenticación que no presentan problemas
- Generación de reportes que ya producen datos correctos
- Navegación y componentes UI que operan adecuadamente

## Hypothesized Root Cause

Basado en el análisis del código y la auditoría de seguridad, las causas raíz más probables son:

1. **Falta de Validaciones Sistemáticas**: Las validaciones se implementan de forma inconsistente, algunas usando Zod, otras con validaciones manuales, y muchas sin validación alguna.

2. **Manejo de Concurrencia Deficiente**: No hay mecanismos robustos para prevenir condiciones de carrera en operaciones críticas como actualización de stock y procesamiento de pagos.

3. **Integridad Referencial Incompleta**: Faltan constraints, triggers y políticas RLS que garanticen la consistencia de datos entre tablas relacionadas.

4. **Gestión de Errores Inconsistente**: Los errores se manejan de forma ad-hoc sin un sistema centralizado de logging y recuperación.

5. **Falta de Testing Sistemático**: No hay una estrategia de testing que cubra casos de borde, concurrencia y integración entre módulos.

## Correctness Properties

Property 1: Bug Condition - Validaciones Sistemáticas

_For any_ operación del sistema donde se requieren validaciones (isBugCondition returns true), el sistema corregido SHALL aplicar validaciones completas usando esquemas Zod, verificar integridad referencial, y manejar errores de forma consistente.

**Validates: Requirements 2.1-2.43**

Property 2: Preservation - Funcionalidad Existente

_For any_ operación que actualmente funciona correctamente (isBugCondition returns false), el sistema corregido SHALL producir exactamente el mismo resultado que el sistema original, preservando performance, comportamiento de UI y integraciones existentes.

**Validates: Requirements 3.1-3.15**

## Fix Implementation

### Arquitectura de Corrección

**1. Capa de Validación Unificada**
```typescript
// lib/validations/unified-schemas.ts
export const productSchema = z.object({
  name: z.string().min(1).max(255),
  barcode: z.string().optional(),
  price: z.number().positive(),
  min_stock: z.number().min(0),
  line_id: z.string().uuid(),
  category_id: z.string().uuid(),
  // ... campos completos
})

export const saleSchema = z.object({
  client_id: z.string().uuid().optional(),
  store_id: z.string().uuid(),
  sale_type: z.enum(['CONTADO', 'CREDITO']),
  items: z.array(saleItemSchema).min(1),
  // ... validaciones completas
})
```

**2. Sistema de Concurrencia**
```typescript
// lib/concurrency/locks.ts
export class OptimisticLock {
  async executeWithLock<T>(
    operation: () => Promise<T>,
    lockKey: string,
    timeout: number = 5000
  ): Promise<T> {
    // Implementación de locks optimistas
  }
}

// lib/concurrency/stock-manager.ts
export class StockManager {
  async updateStockAtomically(
    productId: string,
    quantity: number,
    operation: 'ENTRADA' | 'SALIDA'
  ): Promise<void> {
    // Actualización atómica con verificación de stock
  }
}
```

**3. Integridad de Datos**
```sql
-- supabase/migrations/20260307000001_data_integrity_fixes.sql

-- Constraints para validar límites de crédito
ALTER TABLE clients 
  ADD CONSTRAINT check_credit_limit 
  CHECK (credit_used <= credit_limit);

-- Prevenir múltiples cajas abiertas
CREATE UNIQUE INDEX idx_one_open_shift_per_store 
  ON cash_shifts(store_id) 
  WHERE status = 'OPEN';

-- Triggers para auditoría automática
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    timestamp, user_id, operation, entity_type, 
    entity_id, old_values, new_values
  ) VALUES (
    NOW(), auth.uid(), TG_OP, TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**4. Manejo de Errores Centralizado**
```typescript
// lib/errors/error-handler.ts
export class SystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public module: string,
    public context?: any
  ) {
    super(message)
  }
}

export async function handleSystemError(
  error: unknown,
  context: ErrorContext
): Promise<ErrorResponse> {
  // Log estructurado
  await logError(error, context)
  
  // Notificación si es crítico
  if (isCriticalError(error)) {
    await notifyAdmins(error, context)
  }
  
  // Respuesta sanitizada para el cliente
  return sanitizeErrorResponse(error)
}
```

### Changes Required

**File**: `actions/products.ts`
**Function**: `createProduct`, `updateProduct`, `deleteProduct`
**Specific Changes**:
1. **Validación Completa**: Implementar productSchema con Zod
2. **Verificación de Integridad**: Validar que line_id, category_id existen
3. **Manejo de Imágenes**: Validar y procesar uploads correctamente
4. **Soft Delete**: Implementar eliminación lógica con validación de dependencias
5. **Auditoría**: Registrar todos los cambios en audit_log

**File**: `actions/sales.ts`
**Function**: `createSale`, `voidSale`
**Specific Changes**:
1. **Validación de Stock**: Verificar disponibilidad en tiempo real
2. **Concurrencia**: Usar locks optimistas para actualización de stock
3. **Transacciones Atómicas**: Usar funciones de base de datos para operaciones complejas
4. **Generación de PDF**: Manejo robusto de errores y datos faltantes
5. **Crédito**: Validar límites y actualizar deuda correctamente

**File**: `components/pos/pos-cart.tsx`
**Function**: `addToCart`, `processPayment`
**Specific Changes**:
1. **Validación en Tiempo Real**: Verificar stock antes de agregar
2. **Sincronización**: Mantener consistencia entre carrito y base de datos
3. **Manejo de Errores**: Mostrar mensajes claros al usuario
4. **Estados de Carga**: Prevenir doble-click y operaciones concurrentes

**File**: `lib/reports/generators.ts`
**Function**: Todas las funciones de generación de reportes
**Specific Changes**:
1. **Validación de Filtros**: Verificar rangos de fecha y parámetros
2. **Optimización de Consultas**: Usar índices y agregaciones eficientes
3. **Manejo de Timezone**: Procesar fechas correctamente
4. **Exportación**: Generar archivos válidos sin errores

**File**: `supabase/migrations/`
**Specific Changes**:
1. **RLS Policies**: Habilitar y configurar políticas granulares
2. **Constraints**: Agregar validaciones a nivel de base de datos
3. **Triggers**: Implementar auditoría automática
4. **Índices**: Optimizar consultas frecuentes
5. **Functions**: Crear operaciones atómicas para casos complejos

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de tres fases: primero, identificar y reproducir cada uno de los 43 bugs en el sistema actual; segundo, implementar las correcciones módulo por módulo; tercero, verificar que las correcciones funcionan y no introducen regresiones.

### Exploratory Bug Condition Checking

**Goal**: Reproducir sistemáticamente cada uno de los 43 bugs identificados en el sistema actual para confirmar las causas raíz y establecer casos de prueba de referencia.

**Test Plan**: Crear scripts de testing automatizados que simulen las condiciones específicas que desencadenan cada bug. Ejecutar estos tests en el sistema UNFIXED para documentar los fallos exactos.

**Test Cases**:
1. **Productos - Validación Faltante**: Crear producto con campos vacíos (fallará en sistema actual)
2. **POS - Concurrencia de Stock**: Procesar dos ventas simultáneas del mismo producto (fallará por condición de carrera)
3. **Inventario - Inconsistencias**: Verificar discrepancias entre stock y movements (mostrará inconsistencias)
4. **Reportes - Cálculos Incorrectos**: Generar reporte con filtros de fecha problemáticos (mostrará datos incorrectos)
5. **Caja - Múltiples Turnos**: Abrir dos turnos simultáneos en la misma tienda (permitirá operación incorrecta)

**Expected Counterexamples**:
- Productos creados con datos incompletos o inconsistentes
- Stock negativo por condiciones de carrera en ventas
- Reportes con cálculos incorrectos por problemas de timezone
- Múltiples cajas abiertas simultáneamente
- Errores de generación de PDF por datos faltantes

### Fix Checking

**Goal**: Verificar que para todas las operaciones donde se identificaron bugs, el sistema corregido produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL operation WHERE isBugCondition(operation) DO
  result := executeOperation_fixed(operation)
  ASSERT expectedBehavior(result)
  ASSERT noDataCorruption(result)
  ASSERT properErrorHandling(result)
END FOR
```

**Testing Categories**:

1. **Validación de Datos**: Verificar que todas las validaciones Zod funcionan correctamente
2. **Concurrencia**: Probar operaciones simultáneas con locks optimistas
3. **Integridad Referencial**: Verificar constraints y triggers de base de datos
4. **Manejo de Errores**: Confirmar que errores se manejan y registran correctamente
5. **Performance**: Asegurar que las correcciones no degradan el rendimiento

### Preservation Checking

**Goal**: Verificar que para todas las operaciones que actualmente funcionan correctamente, el sistema corregido produce exactamente los mismos resultados.

**Pseudocode:**
```
FOR ALL operation WHERE NOT isBugCondition(operation) DO
  ASSERT executeOperation_original(operation) = executeOperation_fixed(operation)
END FOR
```

**Testing Approach**: Property-based testing es esencial para preservation checking porque:
- Genera automáticamente miles de casos de prueba
- Cubre combinaciones de datos que testing manual podría omitir
- Proporciona garantías estadísticas de que el comportamiento se preserva
- Detecta regresiones sutiles en funcionalidades existentes

**Test Plan**: Ejecutar tests de regresión exhaustivos en todas las funcionalidades que no requieren corrección.

**Test Cases**:
1. **Consultas de Solo Lectura**: Verificar que reportes que funcionan correctamente siguen produciendo los mismos resultados
2. **Autenticación Funcional**: Confirmar que login/logout siguen funcionando igual
3. **UI Components**: Verificar que componentes que no se modifican mantienen su comportamiento
4. **Integraciones Externas**: Confirmar que APIs de terceros (Google Maps, Resend) siguen funcionando

### Unit Tests

**Módulo por Módulo:**
- **Productos**: Validación de esquemas, creación/edición/eliminación
- **Clientes**: Gestión de crédito, validación de DNI, geolocalización
- **POS**: Carrito, procesamiento de pagos, generación de tickets
- **Inventario**: Movimientos, kardex, consultas de stock
- **Reportes**: Generación, filtros, exportación
- **Caja**: Turnos, gastos, cálculo de diferencias
- **Catálogos**: Visualización, filtros, sincronización con POS
- **Devoluciones**: Procesamiento, ajustes de stock y crédito
- **Autenticación**: Roles, permisos, RLS
- **Base de Datos**: Constraints, triggers, funciones atómicas

### Property-Based Tests

**Generación Automática de Casos:**
- **Stock Management**: Generar secuencias aleatorias de entradas/salidas y verificar consistencia
- **Credit System**: Generar operaciones de crédito aleatorias y verificar que credit_used <= credit_limit
- **Multi-Store Operations**: Generar operaciones en múltiples tiendas y verificar aislamiento de datos
- **Concurrent Operations**: Simular operaciones concurrentes y verificar que no hay condiciones de carrera
- **Data Integrity**: Generar modificaciones aleatorias y verificar que constraints se mantienen

### Integration Tests

**Flujos Completos:**
- **Venta Completa**: Desde agregar productos al carrito hasta generar PDF y actualizar stock
- **Gestión de Crédito**: Desde crear plan de crédito hasta procesar pagos y actualizar deuda
- **Cobranza**: Desde identificar clientes morosos hasta registrar pagos y actualizar estados
- **Inventario**: Desde recibir mercancía hasta venderla y generar reportes de rotación
- **Multi-Store**: Operaciones simultáneas en múltiples tiendas con verificación de aislamiento
- **Backup/Recovery**: Simulación de fallos y verificación de recuperación de datos

**Escenarios de Stress:**
- **High Concurrency**: 100+ operaciones simultáneas de venta
- **Large Data Sets**: Reportes con miles de registros
- **Network Failures**: Simulación de fallos de conectividad con Supabase
- **Resource Limits**: Operaciones con límites de memoria y CPU

### Performance Testing

**Benchmarks de Referencia:**
- Tiempo de respuesta de consultas críticas (< 200ms)
- Throughput de operaciones de venta (> 50 ventas/minuto)
- Generación de reportes complejos (< 5 segundos)
- Carga de catálogo visual (< 2 segundos)

**Métricas de Monitoreo:**
- Latencia de base de datos
- Uso de memoria en operaciones complejas
- Tiempo de generación de PDFs
- Velocidad de sincronización entre módulos

### Automated Testing Pipeline

**CI/CD Integration:**
```yaml
# .github/workflows/test-suite.yml
name: Sistema Tienda Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - name: Setup test database
        run: npm run db:test:setup
      - name: Run integration tests
        run: npm run test:integration
      
  property-based-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - name: Run property-based tests
        run: npm run test:property
        timeout-minutes: 30
      
  performance-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - name: Run performance benchmarks
        run: npm run test:performance
```

**Test Coverage Requirements:**
- Unit Tests: > 90% code coverage
- Integration Tests: 100% de flujos críticos cubiertos
- Property-Based Tests: > 1000 casos generados por propiedad
- Performance Tests: Todos los benchmarks dentro de límites establecidos

Esta estrategia de testing garantiza que las 43 correcciones se implementen correctamente sin introducir regresiones, manteniendo la funcionalidad existente intacta mientras se mejora la robustez y confiabilidad del sistema completo.

## Plan de Implementación

### Fase 1: Fundamentos Críticos (Semana 1-2)

**Prioridad: CRÍTICA** 🔴

**Objetivo**: Establecer las bases sólidas del sistema corrigiendo problemas de seguridad y integridad de datos que afectan todo el sistema.

**Módulos**: Base de Datos + Autenticación

**Tareas Específicas**:

1. **Seguridad y Configuración** (Días 1-2)
   ```bash
   # Rotar todas las claves expuestas
   - Regenerar Supabase keys (anon + service_role)
   - Regenerar Google Maps API key
   - Regenerar Resend API key
   - Actualizar .env.local y remover del repositorio
   ```

2. **Row Level Security** (Días 3-4)
   ```sql
   -- Habilitar RLS en todas las tablas
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
   -- ... (26 tablas total)
   
   -- Crear políticas granulares por rol
   CREATE POLICY "products_read" ON products FOR SELECT
     USING (active = true OR public.has_role('admin'));
   ```

3. **Constraints de Integridad** (Días 5-6)
   ```sql
   -- Validaciones críticas
   ALTER TABLE clients 
     ADD CONSTRAINT check_credit_limit 
     CHECK (credit_used <= credit_limit);
   
   -- Prevenir múltiples cajas abiertas
   CREATE UNIQUE INDEX idx_one_open_shift_per_store 
     ON cash_shifts(store_id) WHERE status = 'OPEN';
   ```

4. **Sistema de Auditoría** (Días 7-8)
   ```sql
   -- Triggers automáticos para auditoría
   CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE
     ON products FOR EACH ROW EXECUTE FUNCTION audit_changes();
   ```

**Criterios de Aceptación**:
- ✅ RLS habilitado y funcionando en todas las tablas
- ✅ Constraints de integridad implementados
- ✅ Sistema de auditoría registrando cambios
- ✅ Claves de seguridad rotadas y protegidas

---

### Fase 2: Validaciones y Manejo de Errores (Semana 3-4)

**Prioridad: ALTA** 🟡

**Objetivo**: Implementar validaciones sistemáticas y manejo de errores centralizado en todos los módulos.

**Módulos**: Productos + Clientes + Validaciones Globales

**Tareas Específicas**:

1. **Sistema de Validación Unificado** (Días 1-3)
   ```typescript
   // lib/validations/schemas.ts
   export const productSchema = z.object({
     name: z.string().min(1).max(255),
     barcode: z.string().optional(),
     price: z.number().positive(),
     min_stock: z.number().min(0),
     line_id: z.string().uuid(),
     category_id: z.string().uuid(),
     brand_id: z.string().uuid().optional(),
     supplier_id: z.string().uuid().optional(),
   })
   
   export const clientSchema = z.object({
     name: z.string().min(1).max(255),
     dni: z.string().regex(/^\d{8}$/),
     phone: z.string().optional(),
     address: z.string().optional(),
     credit_limit: z.number().min(0),
   })
   ```

2. **Manejo de Errores Centralizado** (Días 4-5)
   ```typescript
   // lib/errors/error-handler.ts
   export class SystemError extends Error {
     constructor(
       message: string,
       public code: string,
       public module: string,
       public context?: any
     ) {
       super(message)
     }
   }
   
   export async function handleSystemError(
     error: unknown,
     context: ErrorContext
   ): Promise<ErrorResponse> {
     await logError(error, context)
     if (isCriticalError(error)) {
       await notifyAdmins(error, context)
     }
     return sanitizeErrorResponse(error)
   }
   ```

3. **Corrección Módulo Productos** (Días 6-8)
   ```typescript
   // actions/products.ts - Implementar validaciones completas
   export async function createProduct(data: CreateProductData) {
     // 1. Validar con Zod schema
     const validated = productSchema.parse(data)
     
     // 2. Verificar integridad referencial
     await verifyReferences(validated)
     
     // 3. Crear producto con auditoría
     const result = await createProductWithAudit(validated)
     
     // 4. Manejar errores sistemáticamente
     return handleResult(result)
   }
   ```

4. **Corrección Módulo Clientes** (Días 9-10)
   ```typescript
   // actions/clients.ts - Validaciones de crédito y DNI
   export async function updateCreditLimit(
     clientId: string, 
     newLimit: number
   ) {
     // 1. Validar que newLimit >= credit_used
     const client = await getClient(clientId)
     if (newLimit < client.credit_used) {
       throw new SystemError(
         'Credit limit cannot be less than current debt',
         'INVALID_CREDIT_LIMIT',
         'clients'
       )
     }
     
     // 2. Actualizar con auditoría
     return await updateClientWithAudit(clientId, { credit_limit: newLimit })
   }
   ```

**Criterios de Aceptación**:
- ✅ Esquemas Zod implementados para todos los módulos
- ✅ Sistema de manejo de errores centralizado funcionando
- ✅ Módulos Productos y Clientes validando correctamente
- ✅ Logging estructurado de errores implementado

---

### Fase 3: Concurrencia y Transacciones (Semana 5-6)

**Prioridad: ALTA** 🟡

**Objetivo**: Implementar control de concurrencia y operaciones atómicas para prevenir condiciones de carrera.

**Módulos**: POS + Inventario + Caja

**Tareas Específicas**:

1. **Sistema de Concurrencia** (Días 1-2)
   ```typescript
   // lib/concurrency/locks.ts
   export class OptimisticLock {
     private locks = new Map<string, { timestamp: number; owner: string }>()
     
     async executeWithLock<T>(
       operation: () => Promise<T>,
       lockKey: string,
       timeout: number = 5000
     ): Promise<T> {
       const lockId = await this.acquireLock(lockKey, timeout)
       try {
         return await operation()
       } finally {
         await this.releaseLock(lockKey, lockId)
       }
     }
   }
   ```

2. **Gestión Atómica de Stock** (Días 3-4)
   ```sql
   -- Función atómica para actualizar stock
   CREATE OR REPLACE FUNCTION update_stock_atomic(
     p_product_id UUID,
     p_warehouse_id UUID,
     p_quantity INTEGER,
     p_operation TEXT,
     p_user_id UUID,
     p_reference TEXT DEFAULT NULL
   ) RETURNS BOOLEAN AS $$
   DECLARE
     current_stock INTEGER;
   BEGIN
     -- Lock row para prevenir concurrencia
     SELECT quantity INTO current_stock
     FROM stock 
     WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
     FOR UPDATE;
     
     -- Validar stock suficiente para salidas
     IF p_operation = 'SALIDA' AND current_stock < ABS(p_quantity) THEN
       RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', 
         current_stock, ABS(p_quantity);
     END IF;
     
     -- Actualizar stock
     UPDATE stock 
     SET quantity = quantity + p_quantity,
         last_updated = NOW()
     WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
     
     -- Registrar movimiento
     INSERT INTO movements (
       product_id, warehouse_id, type, quantity, 
       user_id, reference, created_at
     ) VALUES (
       p_product_id, p_warehouse_id, p_operation, ABS(p_quantity),
       p_user_id, p_reference, NOW()
     );
     
     RETURN TRUE;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Corrección Módulo POS** (Días 5-7)
   ```typescript
   // actions/sales.ts - Ventas atómicas
   export async function createSale(saleData: CreateSaleData) {
     return await db.transaction(async (tx) => {
       // 1. Validar datos de venta
       const validated = saleSchema.parse(saleData)
       
       // 2. Verificar stock para todos los items
       for (const item of validated.items) {
         const available = await getAvailableStock(item.product_id)
         if (available < item.quantity) {
           throw new SystemError(
             `Insufficient stock for product ${item.product_id}`,
             'INSUFFICIENT_STOCK',
             'pos'
           )
         }
       }
       
       // 3. Crear venta
       const sale = await tx.sales.create(validated)
       
       // 4. Actualizar stock atómicamente
       for (const item of validated.items) {
         await tx.raw('SELECT update_stock_atomic(?, ?, ?, ?, ?, ?)', [
           item.product_id,
           validated.warehouse_id,
           -item.quantity,
           'SALIDA',
           validated.user_id,
           sale.sale_number
         ])
       }
       
       // 5. Crear plan de crédito si aplica
       if (validated.sale_type === 'CREDITO') {
         await createCreditPlan(tx, sale, validated.client_id)
       }
       
       return sale
     })
   }
   ```

4. **Corrección Módulo Caja** (Días 8-10)
   ```typescript
   // actions/cash.ts - Control de turnos únicos
   export async function openCashShift(storeId: string, userId: string) {
     // 1. Verificar que no hay turno abierto
     const existingShift = await getOpenShift(storeId)
     if (existingShift) {
       throw new SystemError(
         'There is already an open cash shift for this store',
         'SHIFT_ALREADY_OPEN',
         'cash'
       )
     }
     
     // 2. Abrir nuevo turno
     return await createCashShift({
       store_id: storeId,
       user_id: userId,
       status: 'OPEN',
       opened_at: new Date(),
       opening_amount: 0
     })
   }
   ```

**Criterios de Aceptación**:
- ✅ Sistema de locks optimistas implementado
- ✅ Funciones atómicas de base de datos funcionando
- ✅ POS procesando ventas sin condiciones de carrera
- ✅ Control de turnos de caja únicos por tienda

---

### Fase 4: Reportes y Analytics (Semana 7-8)

**Prioridad: MEDIA** 🟢

**Objetivo**: Corregir cálculos incorrectos, manejo de timezone y exportación de reportes.

**Módulos**: Reportes + Analytics

**Tareas Específicas**:

1. **Corrección de Cálculos** (Días 1-3)
   ```typescript
   // lib/reports/calculators.ts
   export class ReportCalculator {
     static calculateProfitMargin(
       revenue: number, 
       cost: number
     ): { profit: number; margin: number } {
       const profit = revenue - cost
       const margin = revenue > 0 ? (profit / revenue) * 100 : 0
       return { 
         profit: Number(profit.toFixed(2)), 
         margin: Number(margin.toFixed(2)) 
       }
     }
     
     static aggregateByPeriod(
       data: any[], 
       dateField: string, 
       period: 'day' | 'month' | 'year'
     ): any[] {
       // Implementación correcta de agregación por período
     }
   }
   ```

2. **Manejo de Timezone** (Días 4-5)
   ```typescript
   // lib/utils/date-utils.ts
   export class DateUtils {
     static toLocalDate(date: string | Date): Date {
       const d = new Date(date)
       // Ajustar a timezone de Perú (UTC-5)
       return new Date(d.getTime() - (5 * 60 * 60 * 1000))
     }
     
     static getDateRange(
       startDate: string, 
       endDate: string
     ): { start: string; end: string } {
       const start = this.toLocalDate(startDate)
       const end = this.toLocalDate(endDate)
       
       // Asegurar que end incluye todo el día
       end.setHours(23, 59, 59, 999)
       
       return {
         start: start.toISOString(),
         end: end.toISOString()
       }
     }
   }
   ```

3. **Exportación Robusta** (Días 6-8)
   ```typescript
   // lib/reports/exporters.ts
   export class ReportExporter {
     static async exportToExcel(
       data: any[], 
       filename: string
     ): Promise<Buffer> {
       try {
         const workbook = new ExcelJS.Workbook()
         const worksheet = workbook.addWorksheet('Reporte')
         
         // Agregar headers
         if (data.length > 0) {
           const headers = Object.keys(data[0])
           worksheet.addRow(headers)
           
           // Agregar datos
           data.forEach(row => {
             worksheet.addRow(Object.values(row))
           })
         }
         
         return await workbook.xlsx.writeBuffer()
       } catch (error) {
         throw new SystemError(
           'Failed to export Excel file',
           'EXPORT_ERROR',
           'reports',
           { filename, error: error.message }
         )
       }
     }
   }
   ```

**Criterios de Aceptación**:
- ✅ Cálculos de reportes corregidos y precisos
- ✅ Manejo correcto de timezone en filtros de fecha
- ✅ Exportación de Excel/PDF funcionando sin errores
- ✅ Performance de reportes optimizada

---

### Fase 5: Integración y UI (Semana 9-10)

**Prioridad: MEDIA** 🟢

**Objetivo**: Corregir problemas de sincronización entre módulos y mejorar experiencia de usuario.

**Módulos**: Catálogos + Devoluciones + UI Components

**Tareas Específicas**:

1. **Sincronización Catálogo-POS** (Días 1-3)
   ```typescript
   // components/catalogs/visual-catalog.tsx
   const handleAddToCart = useCallback(async (variant: ModelVariant) => {
     try {
       // 1. Verificar stock en tiempo real
       const currentStock = await checkRealTimeStock(variant.product_id)
       if (currentStock < 1) {
         toast.error('Producto sin stock')
         return
       }
       
       // 2. Agregar al carrito localStorage
       const cartItem: VisualCartItem = {
         product_id: variant.product_id,
         product_name: variant.name,
         barcode: variant.barcode,
         quantity: 1,
         unit_price: variant.price,
         subtotal: variant.price,
         image_url: variant.image_url,
         size: variant.size,
         color: variant.color,
         base_name: variant.base_name
       }
       
       addToLocalStorageCart(cartItem)
       
       // 3. Sincronizar con POS si está abierto
       if (window.opener) {
         window.opener.postMessage({
           type: 'CART_UPDATED',
           cart: getLocalStorageCart()
         }, '*')
       }
       
       toast.success('Producto agregado al carrito')
     } catch (error) {
       handleError(error, 'catalog-add-to-cart')
     }
   }, [])
   ```

2. **Corrección Módulo Devoluciones** (Días 4-6)
   ```typescript
   // actions/returns.ts
   export async function processReturn(returnData: ProcessReturnData) {
     return await db.transaction(async (tx) => {
       // 1. Validar datos de devolución
       const validated = returnSchema.parse(returnData)
       
       // 2. Verificar que la venta existe y no está anulada
       const sale = await tx.sales.findUnique({
         where: { id: validated.sale_id },
         include: { sale_items: true }
       })
       
       if (!sale || sale.voided) {
         throw new SystemError(
           'Sale not found or already voided',
           'INVALID_SALE',
           'returns'
         )
       }
       
       // 3. Crear registro de devolución
       const returnRecord = await tx.returns.create(validated)
       
       // 4. Restaurar stock
       for (const item of validated.items) {
         await tx.raw('SELECT update_stock_atomic(?, ?, ?, ?, ?, ?)', [
           item.product_id,
           sale.store_id,
           item.quantity,
           'ENTRADA',
           validated.user_id,
           `RETURN-${returnRecord.id}`
         ])
       }
       
       // 5. Ajustar crédito si aplica
       if (sale.sale_type === 'CREDITO') {
         await adjustCreditForReturn(tx, sale.client_id, validated.total_amount)
       }
       
       return returnRecord
     })
   }
   ```

3. **Mejoras de UI** (Días 7-10)
   ```typescript
   // components/ui/error-boundary.tsx
   export class SystemErrorBoundary extends React.Component {
     state = { hasError: false, error: null }
     
     static getDerivedStateFromError(error: Error) {
       return { hasError: true, error }
     }
     
     componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
       // Log error to monitoring system
       logError(error, {
         component: 'ErrorBoundary',
         errorInfo,
         timestamp: new Date().toISOString()
       })
     }
     
     render() {
       if (this.state.hasError) {
         return (
           <div className="error-fallback">
             <h2>Algo salió mal</h2>
             <p>Ha ocurrido un error inesperado. Por favor, recarga la página.</p>
             <button onClick={() => window.location.reload()}>
               Recargar Página
             </button>
           </div>
         )
       }
       
       return this.props.children
     }
   }
   ```

**Criterios de Aceptación**:
- ✅ Sincronización perfecta entre catálogo y POS
- ✅ Devoluciones procesando correctamente stock y crédito
- ✅ UI components con manejo robusto de errores
- ✅ Estados de carga y feedback visual mejorados

---

### Fase 6: Testing y Optimización (Semana 11-12)

**Prioridad: ALTA** 🟡

**Objetivo**: Implementar testing exhaustivo y optimizar performance del sistema completo.

**Tareas Específicas**:

1. **Test Suite Completo** (Días 1-5)
   ```typescript
   // tests/integration/sales-flow.test.ts
   describe('Complete Sales Flow', () => {
     it('should process sale with stock update atomically', async () => {
       // Setup
       const product = await createTestProduct()
       const client = await createTestClient()
       
       // Execute
       const sale = await createSale({
         client_id: client.id,
         items: [{ product_id: product.id, quantity: 2 }],
         sale_type: 'CREDITO'
       })
       
       // Verify
       expect(sale).toBeDefined()
       expect(await getStock(product.id)).toBe(8) // 10 - 2
       expect(await getCreditUsed(client.id)).toBe(sale.total)
     })
   })
   
   // tests/property/stock-consistency.test.ts
   describe('Stock Consistency Properties', () => {
     it('stock should never go negative', async () => {
       await fc.assert(fc.asyncProperty(
         fc.array(fc.record({
           product_id: fc.constantFrom(...testProductIds),
           quantity: fc.integer(1, 10),
           operation: fc.constantFrom('ENTRADA', 'SALIDA')
         })),
         async (operations) => {
           for (const op of operations) {
             try {
               await updateStockAtomic(op)
             } catch (error) {
               // Expected for insufficient stock
             }
           }
           
           const stocks = await getAllStocks()
           return stocks.every(s => s.quantity >= 0)
         }
       ))
     })
   })
   ```

2. **Performance Optimization** (Días 6-8)
   ```sql
   -- Índices optimizados para consultas frecuentes
   CREATE INDEX CONCURRENTLY idx_sales_store_date 
     ON sales(store_id, created_at DESC) 
     WHERE NOT voided;
   
   CREATE INDEX CONCURRENTLY idx_stock_product_warehouse 
     ON stock(product_id, warehouse_id) 
     WHERE quantity > 0;
   
   CREATE INDEX CONCURRENTLY idx_installments_client_status 
     ON installments(client_id, status, due_date) 
     WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE');
   ```

3. **Monitoring y Alertas** (Días 9-10)
   ```typescript
   // lib/monitoring/health-checks.ts
   export class SystemHealthChecker {
     static async checkDatabaseHealth(): Promise<HealthStatus> {
       try {
         const start = Date.now()
         await db.raw('SELECT 1')
         const latency = Date.now() - start
         
         return {
           status: latency < 100 ? 'healthy' : 'degraded',
           latency,
           timestamp: new Date().toISOString()
         }
       } catch (error) {
         return {
           status: 'unhealthy',
           error: error.message,
           timestamp: new Date().toISOString()
         }
       }
     }
     
     static async checkStockConsistency(): Promise<ConsistencyReport> {
       // Verificar que stock table coincide con movements
       const inconsistencies = await db.raw(`
         SELECT p.id, p.name, s.quantity as stock_quantity,
                COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.quantity ELSE -m.quantity END), 0) as calculated_quantity
         FROM products p
         LEFT JOIN stock s ON p.id = s.product_id
         LEFT JOIN movements m ON p.id = m.product_id
         GROUP BY p.id, p.name, s.quantity
         HAVING s.quantity != COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.quantity ELSE -m.quantity END), 0)
       `)
       
       return {
         inconsistencies: inconsistencies.rows,
         count: inconsistencies.rows.length,
         timestamp: new Date().toISOString()
       }
     }
   }
   ```

**Criterios de Aceptación**:
- ✅ Test coverage > 90% en módulos críticos
- ✅ Property-based tests pasando con 1000+ casos
- ✅ Performance benchmarks dentro de límites
- ✅ Sistema de monitoring funcionando

---

## Criterios de Éxito General

### Métricas de Calidad

**Funcionalidad**:
- ✅ Los 43 bugs identificados están corregidos
- ✅ Todas las funcionalidades existentes siguen funcionando
- ✅ No hay regresiones introducidas

**Seguridad**:
- ✅ RLS habilitado y funcionando en todas las tablas
- ✅ Validaciones sistemáticas implementadas
- ✅ Manejo seguro de errores sin exposición de datos

**Performance**:
- ✅ Consultas críticas < 200ms
- ✅ Operaciones de venta < 1 segundo
- ✅ Generación de reportes < 5 segundos

**Confiabilidad**:
- ✅ Operaciones atómicas sin condiciones de carrera
- ✅ Integridad de datos garantizada por constraints
- ✅ Sistema de auditoría completo funcionando

### Plan de Rollback

En caso de problemas durante la implementación:

1. **Rollback de Base de Datos**: Usar migraciones reversibles
2. **Rollback de Código**: Git revert a commits estables
3. **Rollback de Configuración**: Restaurar .env.local desde backup seguro
4. **Verificación Post-Rollback**: Ejecutar test suite completo

### Documentación de Entrega

- ✅ Documentación técnica actualizada
- ✅ Guías de troubleshooting para cada módulo
- ✅ Runbooks para operaciones críticas
- ✅ Plan de mantenimiento y monitoreo continuo

Este plan de implementación garantiza una corrección sistemática y segura de todos los problemas identificados, manteniendo la funcionalidad existente mientras se mejora significativamente la robustez y confiabilidad del sistema completo.