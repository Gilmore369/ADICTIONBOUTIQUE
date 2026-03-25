# Plan de Implementación - Sistema de Tienda Auditoría Completa

## Overview

Este plan de implementación convierte el diseño técnico en tareas específicas y ejecutables siguiendo el enfoque de 6 fases para corregir sistemáticamente los 43 bugs identificados en el sistema de tienda Adiction Boutique.

**Metodología**: Bugfix Requirements-First con Bug Condition methodology
**Duración Total**: 12 semanas (6 fases de 2 semanas cada una)
**Enfoque**: Corrección sistemática + Prevención de regresiones + Testing exhaustivo

---

## FASE 1: FUNDAMENTOS CRÍTICOS (Semanas 1-2)
**Prioridad: CRÍTICA** 🔴

### Objetivo
Establecer las bases sólidas del sistema corrigiendo problemas de seguridad y integridad de datos que afectan todo el sistema.

### 1.1 Exploración de Bugs de Seguridad (ANTES de implementar correcciones)

- [ ] 1.1 Escribir test de exploración de condiciones de bug de seguridad
  - **Property 1: Bug Condition** - Exposición de Claves de Seguridad
  - **CRÍTICO**: Este test DEBE FALLAR en código sin corregir - el fallo confirma que el bug existe
  - **NO intentar arreglar el test o el código cuando falle**
  - **OBJETIVO**: Demostrar que las claves están expuestas en el repositorio
  - **Enfoque PBT Acotado**: Verificar archivos .env.local, .env.example y commits de git
  - Test que las claves de Supabase, Google Maps y Resend están expuestas públicamente
  - Ejecutar test en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Test FALLA (esto es correcto - prueba que el bug existe)
  - Documentar contraejemplos encontrados para entender la causa raíz
  - Marcar tarea completa cuando test esté escrito, ejecutado y fallo documentado
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 1.2 Escribir tests de preservación de seguridad (ANTES de implementar correcciones)
  - **Property 2: Preservation** - Funcionalidad de Autenticación Existente
  - **IMPORTANTE**: Seguir metodología observation-first
  - Observar comportamiento en código SIN CORREGIR para operaciones de auth que funcionan
  - Escribir property-based tests capturando patrones de comportamiento observados
  - Property-based testing genera muchos casos de prueba para garantías más fuertes
  - Ejecutar tests en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Tests PASAN (esto confirma comportamiento base a preservar)
  - Marcar tarea completa cuando tests estén escritos, ejecutados y pasando en código sin corregir
  - _Requirements: 3.10, 3.11, 3.12_

### 1.3 Implementación de Correcciones de Seguridad

- [ ] 1.3 Corrección completa de seguridad y configuración
  - [ ] 1.3.1 Rotar claves de seguridad expuestas
    - Regenerar Supabase keys (anon + service_role)
    - Regenerar Google Maps API key  
    - Regenerar Resend API key
    - Actualizar .env.local con nuevas claves
    - Remover .env.local del repositorio permanentemente
    - _Bug_Condition: isBugCondition(security_keys) donde keys están expuestas públicamente_
    - _Expected_Behavior: expectedBehavior(keys) todas las claves rotadas y protegidas_
    - _Preservation: Mantener funcionalidad de autenticación existente_
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.3.2 Implementar Row Level Security (RLS)
    - Habilitar RLS en todas las 26 tablas del sistema
    - Crear políticas granulares por rol (admin, vendedor, cajero)
    - Implementar políticas de lectura, escritura, actualización y eliminación
    - Validar que usuarios solo accedan a datos de su tienda
    - _Bug_Condition: isBugCondition(table_access) donde RLS está deshabilitado_
    - _Expected_Behavior: expectedBehavior(access) acceso controlado por políticas RLS_
    - _Preservation: Mantener consultas existentes que funcionan correctamente_
    - _Requirements: 2.36, 2.37, 2.38_

  - [ ] 1.3.3 Implementar constraints de integridad críticos
    - Constraint check_credit_limit: credit_used <= credit_limit
    - Índice único para prevenir múltiples cajas abiertas por tienda
    - Constraints de validación de datos críticos (DNI, teléfonos, etc.)
    - Foreign keys con CASCADE/RESTRICT apropiados
    - _Bug_Condition: isBugCondition(data_integrity) donde faltan constraints_
    - _Expected_Behavior: expectedBehavior(integrity) datos consistentes por constraints_
    - _Preservation: Mantener datos históricos válidos intactos_
    - _Requirements: 2.40, 2.41, 2.42_

  - [ ] 1.3.4 Verificar corrección de bugs de seguridad
    - **Property 1: Expected Behavior** - Claves Protegidas y RLS Funcionando
    - **IMPORTANTE**: Re-ejecutar el MISMO test del paso 1.1 - NO escribir test nuevo
    - El test del paso 1.1 codifica el comportamiento esperado
    - Cuando este test pase, confirma que el comportamiento esperado se satisface
    - Ejecutar test de exploración de condiciones de bug del paso 1.1
    - **RESULTADO ESPERADO**: Test PASA (confirma que bug está corregido)
    - _Requirements: Propiedades de Comportamiento Esperado del diseño_

  - [ ] 1.3.5 Verificar que tests de preservación siguen pasando
    - **Property 2: Preservation** - Funcionalidad de Autenticación Preservada
    - **IMPORTANTE**: Re-ejecutar los MISMOS tests del paso 1.2 - NO escribir tests nuevos
    - Ejecutar property-based tests de preservación del paso 1.2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma que no hay regresiones)
    - Confirmar que todas las funcionalidades de auth siguen funcionando

### 1.4 Sistema de Auditoría Automática

- [ ] 1.4 Implementar sistema de auditoría completo
  - Crear tabla audit_log con estructura completa
  - Implementar función audit_changes() para triggers automáticos
  - Crear triggers en todas las tablas críticas (products, sales, clients, etc.)
  - Configurar logging estructurado de errores del sistema
  - Implementar notificaciones automáticas para errores críticos
  - _Bug_Condition: isBugCondition(audit_system) donde no hay trazabilidad_
  - _Expected_Behavior: expectedBehavior(audit) todos los cambios registrados automáticamente_
  - _Preservation: Mantener performance actual de operaciones_
  - _Requirements: 2.42, 2.43_

### 1.5 Checkpoint Fase 1

- [ ] 1.5 Checkpoint - Verificar fundamentos críticos
  - Verificar que RLS está habilitado y funcionando en todas las tablas
  - Confirmar que constraints de integridad están implementados
  - Validar que sistema de auditoría registra cambios correctamente
  - Verificar que claves de seguridad están rotadas y protegidas
  - Ejecutar test suite de seguridad completo
  - Documentar cualquier problema encontrado para resolución inmediata

---

## FASE 2: VALIDACIONES Y MANEJO DE ERRORES (Semanas 3-4)
**Prioridad: ALTA** 🟡

### Objetivo
Implementar validaciones sistemáticas y manejo de errores centralizado en todos los módulos.

### 2.1 Exploración de Bugs de Validación (ANTES de implementar correcciones)

- [ ] 2.1 Escribir test de exploración de condiciones de bug de validación
  - **Property 1: Bug Condition** - Validaciones Faltantes en Productos y Clientes
  - **CRÍTICO**: Este test DEBE FALLAR en código sin corregir
  - **OBJETIVO**: Demostrar que se pueden crear productos/clientes con datos inválidos
  - **Enfoque PBT Acotado**: Casos concretos como DNI duplicado, precios negativos, campos vacíos
  - Test que createProduct() y createClient() permiten datos inconsistentes
  - Ejecutar test en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Test FALLA (confirma que validaciones faltan)
  - Documentar contraejemplos específicos encontrados
  - _Requirements: 1.1, 1.2, 2.1, 2.6_

- [ ] 2.2 Escribir tests de preservación de funcionalidad existente
  - **Property 2: Preservation** - Operaciones Válidas Actuales
  - **IMPORTANTE**: Observar comportamiento en código SIN CORREGIR
  - Observar: createProduct() con datos válidos funciona correctamente
  - Observar: createClient() con datos válidos funciona correctamente  
  - Escribir property-based tests capturando patrones observados
  - Ejecutar tests en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Tests PASAN (confirma comportamiento base)
  - _Requirements: 3.1, 3.2, 3.13_

### 2.3 Implementación de Sistema de Validación Unificado

- [ ] 2.3 Crear sistema de validación unificado con Zod
  - [ ] 2.3.1 Implementar esquemas Zod para todos los módulos
    - Crear productSchema con validaciones completas (name, price, barcode, etc.)
    - Crear clientSchema con validación de DNI, teléfono, límites de crédito
    - Crear saleSchema con validación de items, tipos de pago, montos
    - Crear schemas para inventario, reportes, caja y devoluciones
    - _Bug_Condition: isBugCondition(validation) donde faltan validaciones sistemáticas_
    - _Expected_Behavior: expectedBehavior(validation) todos los datos validados con Zod_
    - _Preservation: Mantener operaciones válidas existentes funcionando_
    - _Requirements: 2.1, 2.6, 2.11, 2.16_

  - [ ] 2.3.2 Implementar manejo de errores centralizado
    - Crear clase SystemError con códigos y contexto estructurado
    - Implementar función handleSystemError para logging y notificaciones
    - Crear sistema de sanitización de errores para respuestas de cliente
    - Implementar logging estructurado con niveles (info, warn, error, critical)
    - _Bug_Condition: isBugCondition(error_handling) donde errores no se manejan sistemáticamente_
    - _Expected_Behavior: expectedBehavior(errors) todos los errores manejados y registrados_
    - _Preservation: Mantener mensajes de error útiles para usuarios_
    - _Requirements: 2.1-2.43 (aplicable a todos los módulos)_

### 2.4 Corrección Módulo Productos

- [ ] 2.4 Corregir completamente el módulo de productos
  - [ ] 2.4.1 Implementar validaciones completas en actions/products.ts
    - Validar todos los campos con productSchema
    - Verificar integridad referencial (line_id, category_id, brand_id existen)
    - Validar unicidad de barcode cuando se proporciona
    - Implementar validación de precios y stock mínimo
    - _Bug_Condition: isBugCondition(product_validation) donde se permiten datos inválidos_
    - _Expected_Behavior: expectedBehavior(product) productos creados solo con datos válidos_
    - _Preservation: Mantener productos existentes válidos intactos_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 2.4.2 Implementar manejo correcto de imágenes de productos
    - Validar formato y tamaño de archivos de imagen
    - Implementar procesamiento robusto de uploads a Supabase Storage
    - Crear sistema de vinculación imagen-producto con colores
    - Manejar errores de upload y storage correctamente
    - _Bug_Condition: isBugCondition(image_upload) donde uploads fallan sin manejo_
    - _Expected_Behavior: expectedBehavior(images) imágenes procesadas y vinculadas correctamente_
    - _Preservation: Mantener imágenes existentes funcionando_
    - _Requirements: 2.4_

  - [ ] 2.4.3 Implementar soft delete con validación de dependencias
    - Verificar que producto no tiene stock antes de eliminar
    - Verificar que producto no tiene ventas asociadas
    - Implementar eliminación lógica (active = false) en lugar de DELETE
    - Crear sistema de auditoría para eliminaciones
    - _Bug_Condition: isBugCondition(product_delete) donde se eliminan productos con dependencias_
    - _Expected_Behavior: expectedBehavior(delete) eliminación segura con validaciones_
    - _Preservation: Mantener integridad de datos históricos_
    - _Requirements: 2.3_

### 2.5 Corrección Módulo Clientes

- [ ] 2.5 Corregir completamente el módulo de clientes
  - [ ] 2.5.1 Implementar validaciones de DNI y datos personales
    - Validar formato de DNI peruano (8 dígitos)
    - Verificar unicidad de DNI en base de datos
    - Validar formato de teléfono y email cuando se proporcionan
    - Implementar validación de direcciones y coordenadas GPS
    - _Bug_Condition: isBugCondition(client_validation) donde se permiten DNI duplicados/inválidos_
    - _Expected_Behavior: expectedBehavior(client) clientes creados solo con datos válidos únicos_
    - _Preservation: Mantener clientes existentes válidos intactos_
    - _Requirements: 2.6, 2.9_

  - [ ] 2.5.2 Implementar validaciones de límites de crédito
    - Validar que credit_limit >= 0
    - Verificar que nuevo credit_limit >= credit_used actual
    - Implementar validación de montos de crédito en operaciones
    - Crear sistema de alertas para límites cercanos al máximo
    - _Bug_Condition: isBugCondition(credit_validation) donde se permiten límites inválidos_
    - _Expected_Behavior: expectedBehavior(credit) límites de crédito siempre válidos y consistentes_
    - _Preservation: Mantener límites de crédito existentes válidos_
    - _Requirements: 2.7, 2.14_

  - [ ] 2.5.3 Verificar corrección de validaciones
    - **Property 1: Expected Behavior** - Validaciones Funcionando
    - Re-ejecutar test de exploración del paso 2.1
    - **RESULTADO ESPERADO**: Test PASA (confirma validaciones implementadas)
    - _Requirements: Propiedades de Comportamiento Esperado del diseño_

  - [ ] 2.5.4 Verificar preservación de funcionalidad
    - **Property 2: Preservation** - Operaciones Válidas Preservadas
    - Re-ejecutar tests de preservación del paso 2.2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma no hay regresiones)

### 2.6 Checkpoint Fase 2

- [ ] 2.6 Checkpoint - Verificar validaciones y manejo de errores
  - Verificar que esquemas Zod están implementados para todos los módulos
  - Confirmar que sistema de manejo de errores centralizado funciona
  - Validar que módulos Productos y Clientes validan correctamente
  - Verificar que logging estructurado de errores está implementado
  - Ejecutar test suite de validaciones completo

---

## FASE 3: CONCURRENCIA Y TRANSACCIONES (Semanas 5-6)
**Prioridad: ALTA** 🟡

### Objetivo
Implementar control de concurrencia y operaciones atómicas para prevenir condiciones de carrera.

### 3.1 Exploración de Bugs de Concurrencia (ANTES de implementar correcciones)

- [ ] 3.1 Escribir test de exploración de condiciones de carrera
  - **Property 1: Bug Condition** - Condiciones de Carrera en Stock y Caja
  - **CRÍTICO**: Este test DEBE FALLAR en código sin corregir
  - **OBJETIVO**: Demostrar que operaciones concurrentes causan inconsistencias
  - **Enfoque PBT Acotado**: Simular 2 ventas simultáneas del mismo producto
  - Test que procesamiento concurrente de ventas causa stock negativo o inconsistente
  - Test que apertura simultánea de caja permite múltiples turnos abiertos
  - Ejecutar test en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Test FALLA (confirma condiciones de carrera existen)
  - Documentar contraejemplos específicos de inconsistencias
  - _Requirements: 3.1, 3.2, 6.1_

- [ ] 3.2 Escribir tests de preservación de operaciones secuenciales
  - **Property 2: Preservation** - Operaciones Secuenciales Correctas
  - **IMPORTANTE**: Observar comportamiento en código SIN CORREGIR
  - Observar: ventas secuenciales (no concurrentes) funcionan correctamente
  - Observar: operaciones de caja secuenciales funcionan correctamente
  - Escribir property-based tests capturando comportamiento secuencial observado
  - Ejecutar tests en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Tests PASAN (confirma comportamiento secuencial base)
  - _Requirements: 3.4, 3.5_

### 3.2 Implementación de Sistema de Concurrencia

- [ ] 3.2 Implementar sistema de locks optimistas
  - [ ] 3.2.1 Crear clase OptimisticLock para control de concurrencia
    - Implementar sistema de locks con timeout configurable
    - Crear mecanismo de adquisición y liberación de locks
    - Implementar retry logic para operaciones fallidas por concurrencia
    - Crear sistema de monitoreo de locks para detectar deadlocks
    - _Bug_Condition: isBugCondition(concurrency) donde operaciones concurrentes causan inconsistencias_
    - _Expected_Behavior: expectedBehavior(locks) operaciones concurrentes controladas por locks_
    - _Preservation: Mantener performance de operaciones secuenciales_
    - _Requirements: 2.40_

  - [ ] 3.2.2 Implementar funciones atómicas de base de datos
    - Crear función update_stock_atomic() con FOR UPDATE locks
    - Implementar validación de stock suficiente antes de actualizar
    - Crear registro automático de movimientos en la misma transacción
    - Implementar rollback automático en caso de errores
    - _Bug_Condition: isBugCondition(atomic_operations) donde actualizaciones no son atómicas_
    - _Expected_Behavior: expectedBehavior(atomic) todas las operaciones de stock son atómicas_
    - _Preservation: Mantener consistencia de datos existentes_
    - _Requirements: 2.12, 2.17, 2.32_

### 3.3 Corrección Módulo POS

- [ ] 3.3 Corregir completamente el módulo POS
  - [ ] 3.3.1 Implementar validación de stock en tiempo real
    - Verificar stock disponible antes de agregar productos al carrito
    - Implementar actualización automática de stock en UI cuando cambia
    - Crear sistema de reserva temporal de stock durante proceso de venta
    - Implementar liberación automática de reservas en caso de cancelación
    - _Bug_Condition: isBugCondition(stock_validation) donde no se valida stock en tiempo real_
    - _Expected_Behavior: expectedBehavior(stock_check) stock siempre validado antes de venta_
    - _Preservation: Mantener flujo de venta existente funcionando_
    - _Requirements: 2.11_

  - [ ] 3.3.2 Implementar procesamiento atómico de ventas
    - Usar transacciones de base de datos para operaciones de venta completas
    - Implementar validación de stock para todos los items antes de procesar
    - Crear actualización atómica de stock usando update_stock_atomic()
    - Implementar creación automática de planes de crédito cuando aplica
    - _Bug_Condition: isBugCondition(sale_processing) donde ventas no son atómicas_
    - _Expected_Behavior: expectedBehavior(atomic_sale) ventas procesadas completamente o fallan completamente_
    - _Preservation: Mantener generación de tickets y PDFs funcionando_
    - _Requirements: 2.12, 2.13, 2.14, 2.15_

  - [ ] 3.3.3 Implementar generación robusta de PDFs
    - Validar que todos los datos requeridos están presentes antes de generar
    - Implementar manejo de errores específico para generación de PDFs
    - Crear sistema de retry para fallos temporales de generación
    - Implementar logging detallado de errores de PDF para debugging
    - _Bug_Condition: isBugCondition(pdf_generation) donde PDFs fallan por datos faltantes_
    - _Expected_Behavior: expectedBehavior(pdf) PDFs generados correctamente o error claro_
    - _Preservation: Mantener formato y contenido de PDFs existentes_
    - _Requirements: 2.13_

### 3.4 Corrección Módulo Caja

- [ ] 3.4 Corregir completamente el módulo de caja
  - [ ] 3.4.1 Implementar control de turnos únicos por tienda
    - Crear constraint único para prevenir múltiples turnos abiertos
    - Implementar validación antes de abrir nuevo turno
    - Crear sistema de cierre automático de turnos abandonados
    - Implementar auditoría completa de operaciones de caja
    - _Bug_Condition: isBugCondition(cash_shifts) donde múltiples turnos pueden estar abiertos_
    - _Expected_Behavior: expectedBehavior(unique_shift) solo un turno abierto por tienda_
    - _Preservation: Mantener funcionalidad de caja existente_
    - _Requirements: 2.24, 2.25, 2.26, 2.27_

  - [ ] 3.4.2 Implementar validaciones de gastos y balances
    - Validar que gastos no excedan efectivo disponible en caja
    - Implementar cálculo automático de diferencias al cierre
    - Crear sistema de alertas para diferencias significativas
    - Implementar registro detallado de todas las transacciones de caja
    - _Bug_Condition: isBugCondition(cash_validation) donde gastos no se validan contra disponible_
    - _Expected_Behavior: expectedBehavior(cash_balance) balances de caja siempre correctos_
    - _Preservation: Mantener historial de caja existente intacto_
    - _Requirements: 2.25, 2.26_

  - [ ] 3.4.3 Verificar corrección de concurrencia
    - **Property 1: Expected Behavior** - Operaciones Atómicas Funcionando
    - Re-ejecutar test de exploración del paso 3.1
    - **RESULTADO ESPERADO**: Test PASA (confirma concurrencia controlada)
    - _Requirements: Propiedades de Comportamiento Esperado del diseño_

  - [ ] 3.4.4 Verificar preservación de operaciones secuenciales
    - **Property 2: Preservation** - Operaciones Secuenciales Preservadas
    - Re-ejecutar tests de preservación del paso 3.2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma no hay regresiones)

### 3.5 Checkpoint Fase 3

- [ ] 3.5 Checkpoint - Verificar concurrencia y transacciones
  - Verificar que sistema de locks optimistas está implementado
  - Confirmar que funciones atómicas de base de datos funcionan correctamente
  - Validar que POS procesa ventas sin condiciones de carrera
  - Verificar que control de turnos de caja únicos por tienda funciona
  - Ejecutar test suite de concurrencia completo

---

## FASE 4: REPORTES Y ANALYTICS (Semanas 7-8)
**Prioridad: MEDIA** 🟢

### Objetivo
Corregir cálculos incorrectos, manejo de timezone y exportación de reportes.

### 4.1 Exploración de Bugs de Reportes (ANTES de implementar correcciones)

- [ ] 4.1 Escribir test de exploración de cálculos incorrectos
  - **Property 1: Bug Condition** - Cálculos Incorrectos y Timezone
  - **CRÍTICO**: Este test DEBE FALLAR en código sin corregir
  - **OBJETIVO**: Demostrar que reportes producen cálculos incorrectos
  - **Enfoque PBT Acotado**: Casos específicos como filtros de fecha, márgenes de ganancia
  - Test que generateProfitMarginReport() produce cálculos incorrectos
  - Test que filtros de fecha no manejan timezone correctamente
  - Test que exportación de Excel/PDF falla con ciertos datos
  - Ejecutar test en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Test FALLA (confirma cálculos incorrectos)
  - Documentar contraejemplos específicos de cálculos erróneos
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 4.2 Escribir tests de preservación de reportes funcionales
  - **Property 2: Preservation** - Reportes que Funcionan Correctamente
  - **IMPORTANTE**: Observar comportamiento en código SIN CORREGIR
  - Observar: reportes simples que producen datos correctos funcionan bien
  - Observar: consultas básicas sin filtros complejos funcionan correctamente
  - Escribir property-based tests capturando comportamiento observado
  - Ejecutar tests en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Tests PASAN (confirma reportes base funcionando)
  - _Requirements: 3.4, 3.5_

### 4.2 Implementación de Correcciones de Reportes

- [ ] 4.2 Corregir sistema de reportes y analytics
  - [ ] 4.2.1 Implementar cálculos correctos de reportes
    - Corregir función calculateProfitMargin() con precisión decimal
    - Implementar aggregateByPeriod() con manejo correcto de fechas
    - Corregir cálculos de rotación de inventario y valorización
    - Implementar validación de datos antes de cálculos
    - _Bug_Condition: isBugCondition(report_calculations) donde cálculos son incorrectos_
    - _Expected_Behavior: expectedBehavior(calculations) todos los cálculos precisos y correctos_
    - _Preservation: Mantener formato y estructura de reportes existentes_
    - _Requirements: 2.20, 2.22_

  - [ ] 4.2.2 Implementar manejo correcto de timezone
    - Crear clase DateUtils para manejo consistente de fechas
    - Implementar conversión correcta a timezone de Perú (UTC-5)
    - Corregir función getDateRange() para incluir días completos
    - Implementar validación de rangos de fecha en filtros
    - _Bug_Condition: isBugCondition(timezone_handling) donde fechas no se manejan correctamente_
    - _Expected_Behavior: expectedBehavior(dates) fechas procesadas correctamente en timezone local_
    - _Preservation: Mantener datos históricos con fechas correctas_
    - _Requirements: 2.23_

  - [ ] 4.2.3 Implementar exportación robusta de reportes
    - Crear clase ReportExporter con manejo de errores robusto
    - Implementar generación de Excel con formato correcto
    - Crear generación de PDF con datos completos y formato
    - Implementar validación de datos antes de exportar
    - _Bug_Condition: isBugCondition(report_export) donde exportación falla_
    - _Expected_Behavior: expectedBehavior(export) archivos generados correctamente sin errores_
    - _Preservation: Mantener formatos de exportación existentes_
    - _Requirements: 2.21_

### 4.3 Optimización de Performance de Reportes

- [ ] 4.3 Optimizar performance de consultas de reportes
  - [ ] 4.3.1 Crear índices optimizados para reportes
    - Índice idx_sales_store_date para consultas de ventas por tienda y fecha
    - Índice idx_stock_product_warehouse para consultas de inventario
    - Índice idx_installments_client_status para reportes de crédito
    - Índice idx_movements_product_date para reportes de kardex
    - _Bug_Condition: isBugCondition(report_performance) donde consultas son lentas_
    - _Expected_Behavior: expectedBehavior(performance) reportes generados en < 5 segundos_
    - _Preservation: Mantener tiempos de respuesta de consultas optimizadas existentes_
    - _Requirements: 3.4_

  - [ ] 4.3.2 Implementar cache de reportes frecuentes
    - Crear sistema de cache para reportes que se consultan frecuentemente
    - Implementar invalidación automática de cache cuando datos cambian
    - Crear métricas de hit rate de cache para monitoreo
    - Implementar configuración de TTL por tipo de reporte
    - _Bug_Condition: isBugCondition(report_cache) donde reportes se recalculan innecesariamente_
    - _Expected_Behavior: expectedBehavior(cache) reportes servidos desde cache cuando apropiado_
    - _Preservation: Mantener datos actualizados en reportes en tiempo real_
    - _Requirements: 2.22_

  - [ ] 4.3.3 Verificar corrección de reportes
    - **Property 1: Expected Behavior** - Cálculos y Exportación Correctos
    - Re-ejecutar test de exploración del paso 4.1
    - **RESULTADO ESPERADO**: Test PASA (confirma reportes corregidos)
    - _Requirements: Propiedades de Comportamiento Esperado del diseño_

  - [ ] 4.3.4 Verificar preservación de reportes funcionales
    - **Property 2: Preservation** - Reportes Funcionales Preservados
    - Re-ejecutar tests de preservación del paso 4.2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma no hay regresiones)

### 4.4 Checkpoint Fase 4

- [ ] 4.4 Checkpoint - Verificar reportes y analytics
  - Verificar que cálculos de reportes son correctos y precisos
  - Confirmar que manejo de timezone funciona correctamente
  - Validar que exportación de Excel/PDF funciona sin errores
  - Verificar que performance de reportes está optimizada
  - Ejecutar test suite de reportes completo

---

## FASE 5: INTEGRACIÓN Y UI (Semanas 9-10)
**Prioridad: MEDIA** 🟢

### Objetivo
Corregir problemas de sincronización entre módulos y mejorar experiencia de usuario.

### 5.1 Exploración de Bugs de Integración (ANTES de implementar correcciones)

- [ ] 5.1 Escribir test de exploración de problemas de sincronización
  - **Property 1: Bug Condition** - Desincronización Catálogo-POS y Devoluciones
  - **CRÍTICO**: Este test DEBE FALLAR en código sin corregir
  - **OBJETIVO**: Demostrar que módulos no se sincronizan correctamente
  - **Enfoque PBT Acotado**: Casos específicos de agregar al carrito desde catálogo
  - Test que productos agregados desde catálogo no aparecen en POS
  - Test que devoluciones no actualizan stock correctamente
  - Test que imágenes de catálogo no cargan correctamente
  - Ejecutar test en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Test FALLA (confirma problemas de sincronización)
  - Documentar contraejemplos específicos de desincronización
  - _Requirements: 7.3, 8.1, 8.2_

- [ ] 5.2 Escribir tests de preservación de UI funcional
  - **Property 2: Preservation** - Componentes UI que Funcionan
  - **IMPORTANTE**: Observar comportamiento en código SIN CORREGIR
  - Observar: componentes UI que funcionan correctamente mantienen su comportamiento
  - Observar: navegación que funciona bien sigue operando correctamente
  - Escribir property-based tests capturando comportamiento UI observado
  - Ejecutar tests en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Tests PASAN (confirma UI base funcionando)
  - _Requirements: 3.13, 3.14, 3.15_

### 5.2 Corrección de Sincronización Catálogo-POS

- [ ] 5.2 Corregir sincronización entre catálogo y POS
  - [ ] 5.2.1 Implementar sincronización en tiempo real
    - Crear sistema de comunicación entre ventanas usando postMessage
    - Implementar verificación de stock en tiempo real antes de agregar al carrito
    - Crear sincronización automática de carrito entre catálogo y POS
    - Implementar actualización automática de UI cuando stock cambia
    - _Bug_Condition: isBugCondition(catalog_sync) donde catálogo y POS no se sincronizan_
    - _Expected_Behavior: expectedBehavior(sync) catálogo y POS siempre sincronizados_
    - _Preservation: Mantener funcionalidad individual de catálogo y POS_
    - _Requirements: 2.30_

  - [ ] 5.2.2 Corregir carga de imágenes en catálogo
    - Implementar manejo robusto de errores de carga de imágenes
    - Crear sistema de fallback para imágenes faltantes
    - Implementar lazy loading para mejorar performance
    - Crear sistema de cache de imágenes en cliente
    - _Bug_Condition: isBugCondition(image_loading) donde imágenes no cargan correctamente_
    - _Expected_Behavior: expectedBehavior(images) todas las imágenes cargan correctamente o muestran fallback_
    - _Preservation: Mantener imágenes existentes funcionando_
    - _Requirements: 2.28_

### 5.3 Corrección Módulo Devoluciones

- [ ] 5.3 Corregir completamente el módulo de devoluciones
  - [ ] 5.3.1 Implementar procesamiento atómico de devoluciones
    - Usar transacciones para operaciones completas de devolución
    - Implementar validación de que venta existe y no está anulada
    - Crear actualización atómica de stock usando update_stock_atomic()
    - Implementar ajuste correcto de crédito para ventas a crédito
    - _Bug_Condition: isBugCondition(return_processing) donde devoluciones no son atómicas_
    - _Expected_Behavior: expectedBehavior(atomic_return) devoluciones procesadas completamente o fallan_
    - _Preservation: Mantener historial de devoluciones existente_
    - _Requirements: 2.32, 2.33_

  - [ ] 5.3.2 Implementar generación robusta de comprobantes
    - Validar datos completos antes de generar comprobante PDF
    - Implementar manejo de errores específico para generación de comprobantes
    - Crear formato estándar para comprobantes de devolución
    - Implementar logging detallado para debugging de errores
    - _Bug_Condition: isBugCondition(return_receipt) donde comprobantes fallan_
    - _Expected_Behavior: expectedBehavior(receipt) comprobantes generados correctamente_
    - _Preservation: Mantener formato de comprobantes existentes_
    - _Requirements: 2.34_

### 5.4 Mejoras de UI y UX

- [ ] 5.4 Implementar mejoras de experiencia de usuario
  - [ ] 5.4.1 Crear sistema robusto de manejo de errores en UI
    - Implementar ErrorBoundary para capturar errores de React
    - Crear sistema de notificaciones toast consistente
    - Implementar estados de carga y feedback visual
    - Crear páginas de error amigables para usuarios
    - _Bug_Condition: isBugCondition(ui_errors) donde errores no se manejan en UI_
    - _Expected_Behavior: expectedBehavior(ui_handling) errores manejados con feedback claro_
    - _Preservation: Mantener componentes UI que funcionan correctamente_
    - _Requirements: 3.13, 3.14_

  - [ ] 5.4.2 Implementar validación en tiempo real en formularios
    - Crear validación inmediata de campos mientras usuario escribe
    - Implementar mensajes de error claros y específicos
    - Crear indicadores visuales de campos válidos/inválidos
    - Implementar prevención de envío con datos inválidos
    - _Bug_Condition: isBugCondition(form_validation) donde validación no es inmediata_
    - _Expected_Behavior: expectedBehavior(real_time) validación inmediata con feedback claro_
    - _Preservation: Mantener formularios que funcionan correctamente_
    - _Requirements: 3.15_

  - [ ] 5.4.3 Verificar corrección de integración
    - **Property 1: Expected Behavior** - Sincronización y UI Funcionando
    - Re-ejecutar test de exploración del paso 5.1
    - **RESULTADO ESPERADO**: Test PASA (confirma sincronización corregida)
    - _Requirements: Propiedades de Comportamiento Esperado del diseño_

  - [ ] 5.4.4 Verificar preservación de UI funcional
    - **Property 2: Preservation** - UI Funcional Preservada
    - Re-ejecutar tests de preservación del paso 5.2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma no hay regresiones en UI)

### 5.5 Checkpoint Fase 5

- [ ] 5.5 Checkpoint - Verificar integración y UI
  - Verificar que sincronización entre catálogo y POS funciona perfectamente
  - Confirmar que devoluciones procesan correctamente stock y crédito
  - Validar que UI components manejan errores robustamente
  - Verificar que estados de carga y feedback visual están implementados
  - Ejecutar test suite de integración completo

---

## FASE 6: TESTING Y OPTIMIZACIÓN (Semanas 11-12)
**Prioridad: ALTA** 🟡

### Objetivo
Implementar testing exhaustivo y optimizar performance del sistema completo.

### 6.1 Implementación de Test Suite Completo

- [ ] 6.1 Crear test suite exhaustivo para todos los módulos
  - [ ] 6.1.1 Implementar tests de integración de flujos completos
    - Test de flujo completo de venta: carrito → pago → stock → PDF
    - Test de flujo completo de crédito: plan → cuotas → pagos → deuda
    - Test de flujo completo de cobranza: morosos → acciones → pagos
    - Test de flujo completo de inventario: entrada → venta → kardex
    - _Bug_Condition: isBugCondition(integration_flows) donde flujos completos fallan_
    - _Expected_Behavior: expectedBehavior(flows) todos los flujos funcionan end-to-end_
    - _Preservation: Mantener flujos existentes que funcionan correctamente_
    - _Requirements: 2.1-2.43 (todos los módulos integrados)_

  - [ ] 6.1.2 Implementar property-based tests para consistencia de datos
    - Property test: stock nunca debe ser negativo después de operaciones
    - Property test: credit_used nunca debe exceder credit_limit
    - Property test: suma de movimientos debe igualar stock actual
    - Property test: operaciones concurrentes mantienen consistencia
    - _Bug_Condition: isBugCondition(data_consistency) donde datos se vuelven inconsistentes_
    - _Expected_Behavior: expectedBehavior(consistency) datos siempre consistentes_
    - _Preservation: Mantener consistencia de datos existentes_
    - _Requirements: 2.40, 2.41_

### 6.2 Optimización de Performance

- [ ] 6.2 Optimizar performance del sistema completo
  - [ ] 6.2.1 Crear índices optimizados para todas las consultas críticas
    - Índices para consultas de ventas por tienda y fecha
    - Índices para consultas de stock por producto y almacén
    - Índices para consultas de crédito por cliente y estado
    - Índices para consultas de auditoría y logging
    - _Bug_Condition: isBugCondition(query_performance) donde consultas son lentas_
    - _Expected_Behavior: expectedBehavior(fast_queries) consultas críticas < 200ms_
    - _Preservation: Mantener performance de consultas optimizadas existentes_
    - _Requirements: 3.4, 3.5_

  - [ ] 6.2.2 Implementar optimizaciones de memoria y CPU
    - Optimizar componentes React con memo y useMemo
    - Implementar lazy loading para componentes pesados
    - Crear paginación eficiente para listas grandes
    - Implementar debouncing para búsquedas en tiempo real
    - _Bug_Condition: isBugCondition(resource_usage) donde uso de recursos es excesivo_
    - _Expected_Behavior: expectedBehavior(efficient) uso eficiente de memoria y CPU_
    - _Preservation: Mantener funcionalidad mientras se optimiza_
    - _Requirements: 3.4, 3.5_

### 6.3 Sistema de Monitoreo y Alertas

- [ ] 6.3 Implementar sistema de monitoreo completo
  - [ ] 6.3.1 Crear health checks automáticos
    - Health check de conectividad a base de datos
    - Health check de consistencia de datos críticos
    - Health check de performance de operaciones críticas
    - Health check de disponibilidad de servicios externos
    - _Bug_Condition: isBugCondition(system_health) donde problemas no se detectan automáticamente_
    - _Expected_Behavior: expectedBehavior(monitoring) problemas detectados y reportados automáticamente_
    - _Preservation: Mantener disponibilidad del sistema_
    - _Requirements: Todos los módulos (monitoreo general)_

  - [ ] 6.3.2 Implementar sistema de alertas proactivas
    - Alertas para errores críticos en tiempo real
    - Alertas para degradación de performance
    - Alertas para inconsistencias de datos detectadas
    - Alertas para fallos de servicios externos
    - _Bug_Condition: isBugCondition(alerting) donde problemas no se notifican_
    - _Expected_Behavior: expectedBehavior(alerts) problemas notificados inmediatamente_
    - _Preservation: Mantener operación normal sin alertas falsas_
    - _Requirements: Sistema completo (alertas generales)_

### 6.4 Documentación y Runbooks

- [ ] 6.4 Crear documentación completa del sistema
  - [ ] 6.4.1 Documentar procedimientos de troubleshooting
    - Guías paso a paso para resolver problemas comunes
    - Runbooks para operaciones críticas (backup, recovery, etc.)
    - Documentación de códigos de error y sus soluciones
    - Guías de escalación para problemas críticos
    - _Bug_Condition: isBugCondition(documentation) donde falta documentación operativa_
    - _Expected_Behavior: expectedBehavior(docs) documentación completa y actualizada_
    - _Preservation: Mantener conocimiento operativo del sistema_
    - _Requirements: Sistema completo (documentación general)_

  - [ ] 6.4.2 Crear plan de mantenimiento y monitoreo continuo
    - Calendario de tareas de mantenimiento preventivo
    - Procedimientos de backup y recovery
    - Plan de actualizaciones y patches de seguridad
    - Métricas y KPIs para monitoreo continuo
    - _Bug_Condition: isBugCondition(maintenance) donde no hay plan de mantenimiento_
    - _Expected_Behavior: expectedBehavior(maintenance) sistema mantenido proactivamente_
    - _Preservation: Mantener estabilidad y seguridad del sistema_
    - _Requirements: Sistema completo (mantenimiento general)_

### 6.5 Validación Final y Entrega

- [ ] 6.5 Ejecutar validación final completa del sistema
  - [ ] 6.5.1 Ejecutar test suite completo
    - Ejecutar todos los tests unitarios (>90% coverage)
    - Ejecutar todos los tests de integración
    - Ejecutar todos los property-based tests (>1000 casos cada uno)
    - Ejecutar tests de performance y benchmarks
    - _Bug_Condition: isBugCondition(test_coverage) donde tests no cubren casos críticos_
    - _Expected_Behavior: expectedBehavior(testing) todos los tests pasan consistentemente_
    - _Preservation: Mantener calidad y confiabilidad del sistema_
    - _Requirements: 2.1-2.43 (validación de todas las correcciones)_

  - [ ] 6.5.2 Validar corrección de los 43 bugs originales
    - Verificar que cada uno de los 43 bugs identificados está corregido
    - Confirmar que no se han introducido regresiones
    - Validar que todas las funcionalidades existentes siguen funcionando
    - Documentar el estado final de cada corrección implementada
    - _Bug_Condition: isBugCondition(original_bugs) donde bugs originales persisten_
    - _Expected_Behavior: expectedBehavior(bug_free) todos los 43 bugs corregidos_
    - _Preservation: Mantener toda la funcionalidad existente intacta_
    - _Requirements: 1.1-2.43 (todos los bugs y preservación)_

### 6.6 Checkpoint Final

- [ ] 6.6 Checkpoint final - Sistema completo funcionando
  - Verificar que test suite completo pasa consistentemente
  - Confirmar que performance está dentro de benchmarks establecidos
  - Validar que sistema de monitoreo y alertas funciona
  - Verificar que documentación está completa y actualizada
  - Confirmar que los 43 bugs originales están corregidos
  - Validar que no hay regresiones en funcionalidad existente
  - Documentar entrega final y plan de mantenimiento

---

## CRITERIOS DE ÉXITO GENERAL

### Métricas de Calidad Requeridas

**Funcionalidad**:
- ✅ Los 43 bugs identificados están 100% corregidos
- ✅ Todas las funcionalidades existentes siguen funcionando sin cambios
- ✅ Cero regresiones introducidas durante las correcciones

**Seguridad**:
- ✅ RLS habilitado y funcionando correctamente en todas las 26 tablas
- ✅ Validaciones sistemáticas implementadas en todos los módulos
- ✅ Manejo seguro de errores sin exposición de información sensible
- ✅ Claves de seguridad rotadas y protegidas correctamente

**Performance**:
- ✅ Consultas críticas ejecutan en < 200ms
- ✅ Operaciones de venta completas en < 1 segundo
- ✅ Generación de reportes complejos en < 5 segundos
- ✅ Carga de páginas principales en < 2 segundos

**Confiabilidad**:
- ✅ Operaciones atómicas sin condiciones de carrera
- ✅ Integridad de datos garantizada por constraints y triggers
- ✅ Sistema de auditoría completo registrando todos los cambios
- ✅ Manejo robusto de errores con recovery automático

**Testing**:
- ✅ Cobertura de tests unitarios > 90%
- ✅ Tests de integración cubriendo 100% de flujos críticos
- ✅ Property-based tests con > 1000 casos por propiedad
- ✅ Tests de performance validando todos los benchmarks

### Plan de Rollback de Emergencia

En caso de problemas críticos durante la implementación:

1. **Rollback de Base de Datos**: 
   - Usar migraciones reversibles para volver a estado anterior
   - Restaurar backup de base de datos si es necesario
   - Validar integridad de datos después del rollback

2. **Rollback de Código**: 
   - Git revert a commits estables identificados
   - Desplegar versión anterior verificada
   - Validar que funcionalidad crítica opera correctamente

3. **Rollback de Configuración**: 
   - Restaurar .env.local desde backup seguro
   - Revertir configuraciones de Supabase si es necesario
   - Validar conectividad y permisos

4. **Verificación Post-Rollback**: 
   - Ejecutar test suite completo para confirmar estabilidad
   - Validar operaciones críticas manualmente
   - Monitorear sistema por 24 horas para detectar problemas

### Documentación de Entrega Final

**Documentación Técnica**:
- ✅ Arquitectura del sistema actualizada con todas las correcciones
- ✅ Documentación de APIs y esquemas de base de datos
- ✅ Guías de desarrollo y contribución actualizadas

**Documentación Operativa**:
- ✅ Runbooks para operaciones críticas (backup, recovery, deployment)
- ✅ Guías de troubleshooting para cada módulo
- ✅ Procedimientos de escalación para problemas críticos
- ✅ Plan de mantenimiento y monitoreo continuo

**Documentación de Usuario**:
- ✅ Guías de usuario actualizadas con nuevas funcionalidades
- ✅ Documentación de cambios y mejoras implementadas
- ✅ FAQ con problemas comunes y sus soluciones

Este plan de implementación garantiza una corrección sistemática, segura y completa de todos los problemas identificados, manteniendo la funcionalidad existente mientras se mejora significativamente la robustez, seguridad y confiabilidad del sistema completo de tienda Adiction Boutique.