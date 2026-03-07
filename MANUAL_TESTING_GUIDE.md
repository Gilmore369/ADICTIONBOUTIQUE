# Guía de Pruebas Manuales - Sistema Boutique

## Estado del Sistema
✅ Servidor de desarrollo corriendo en http://localhost:3000
✅ Todos los archivos sin errores de diagnóstico
✅ Migraciones SQL creadas (pendientes de ejecutar)

---

## 1. PRUEBAS DE PDF DE TICKETS

### 1.1 Generar Venta y Descargar PDF
1. Navegar a `/pos`
2. Agregar productos al carrito
3. Seleccionar cliente
4. Completar venta (CONTADO o CRÉDITO)
5. En el modal de confirmación, hacer clic en "Descargar PDF"
6. **Verificar:**
   - ✅ PDF se descarga con nombre `Ticket_V-XXXX.pdf`
   - ✅ Logo de ADICTION BOUTIQUE aparece arriba
   - ✅ Formato 80mm de ancho
   - ✅ Tabla sin fondo negro, diseño limpio con líneas
   - ✅ QR code de 60x60pt (no muy grande)
   - ✅ Información completa: productos, precios, totales
   - ✅ Si es CRÉDITO: aparecen las cuotas (6 por defecto)
   - ✅ No hay espacios en blanco excesivos
   - ✅ Contenido no se recorta

### 1.2 Prueba de Impresión
1. Después de descargar el PDF, abrirlo
2. Hacer clic en "Imprimir" (Ctrl+P)
3. **Verificar:**
   - ⚠️ NOTA: Los navegadores no siempre respetan el formato 80mm auto
   - ✅ Mejor usar el botón "Descargar PDF" en lugar de "Imprimir"
   - ✅ El PDF descargado tiene el formato correcto

---

## 2. PRUEBAS DE HISTORIAL DE VENTAS

### 2.1 Acceso y Dashboard
1. Navegar a `/sales` (o desde sidebar: Historial de Ventas)
2. **Verificar:**
   - ✅ Dashboard con 4 indicadores:
     - Ventas Hoy (verde)
     - Ventas del Mes (azul)
     - Ticket Promedio (morado)
     - Contado vs Crédito (naranja)
   - ✅ Tabla con todas las ventas
   - ✅ Columnas: Ticket, Fecha, Cliente, Tipo, Tienda, Total, Acciones

### 2.2 Filtros
1. Probar búsqueda por número de ticket
2. Probar búsqueda por nombre de cliente
3. Filtrar por período (Hoy, Semana, Mes, Todo)
4. Filtrar por tipo de pago (Contado, Crédito)
5. Filtrar por tienda
6. **Verificar:**
   - ✅ Filtros funcionan correctamente
   - ✅ Contador muestra "Mostrando X de Y ventas"
   - ✅ Botón "Limpiar filtros" funciona

### 2.3 Descargar PDF desde Historial
1. Hacer clic en botón "PDF" de cualquier venta
2. **Verificar:**
   - ✅ PDF se descarga correctamente
   - ✅ Nombre: `Ticket_V-XXXX.pdf`
   - ✅ Contenido correcto de la venta

---

## 3. PRUEBAS DE DEVOLUCIONES

### 3.1 Ejecutar Migración SQL (PRIMERO)
```sql
-- Ejecutar en Supabase SQL Editor:
-- Archivo: supabase/migrations/20260307000000_create_returns_table.sql
```

### 3.2 Acceso y Dashboard
1. Navegar a `/returns` (o desde sidebar: Devoluciones)
2. **Verificar:**
   - ✅ Dashboard con 4 indicadores:
     - Pendientes (amarillo)
     - Aprobadas (azul)
     - Completadas (verde)
     - Total (morado)
   - ✅ Tabla de devoluciones
   - ✅ Columnas: Número, Venta, Fecha, Cliente, Motivo, Tipo, Monto, Estado, Acciones

### 3.3 Crear Nueva Devolución
1. Hacer clic en "Nueva Devolución"
2. Buscar una venta reciente (últimos 7 días)
3. Seleccionar productos a devolver
4. Elegir motivo:
   - Defecto del producto
   - Talla incorrecta
   - Color diferente
   - No satisfecho
   - Cambió de opinión
   - Otro
5. Elegir tipo: REEMBOLSO o CAMBIO
6. Agregar notas (opcional)
7. Crear devolución
8. **Verificar:**
   - ✅ Devolución creada con número DEV-0001, DEV-0002, etc.
   - ✅ Estado inicial: PENDIENTE
   - ✅ Aparece en la tabla

### 3.4 Aprobar/Rechazar Devolución
1. En una devolución PENDIENTE, hacer clic en "Aprobar"
2. **Verificar:**
   - ✅ Estado cambia a APROBADA
   - ✅ Botones de acción cambian
3. Crear otra devolución y hacer clic en "Rechazar"
4. **Verificar:**
   - ✅ Estado cambia a RECHAZADA

### 3.5 Ver Detalles
1. Hacer clic en "Ver" en cualquier devolución
2. **Verificar:**
   - ✅ Modal muestra información completa
   - ✅ Productos devueltos
   - ✅ Motivo y notas
   - ✅ Estado y fechas

### 3.6 Elegibilidad de Devolución
1. Intentar crear devolución de venta antigua (>7 días)
2. **Verificar:**
   - ✅ Sistema indica que no es elegible
   - ✅ Opción de solicitar extensión
3. Solicitar extensión
4. **Verificar:**
   - ✅ Extensión registrada
   - ✅ Plazo extendido a 14 días

---

## 4. PRUEBAS DE LISTA NEGRA

### 4.1 Ejecutar Migración SQL (PRIMERO)
```sql
-- Ejecutar en Supabase SQL Editor:
-- Archivo: supabase/migrations/20260306000001_add_blacklist_fields.sql
```

### 4.2 Acceso y Dashboard
1. Navegar a `/clients/blacklist` (o desde sidebar: Clientes > Lista Negra)
2. **Verificar:**
   - ✅ Dashboard con indicadores
   - ✅ Tabla de clientes bloqueados

### 4.3 Agregar Cliente a Lista Negra
1. Hacer clic en "Agregar a Lista Negra"
2. Buscar cliente
3. Seleccionar motivo:
   - Deuda excesiva
   - No paga
   - Decisión de gerencia
   - Mal comportamiento
   - Otro
4. Agregar notas
5. Confirmar
6. **Verificar:**
   - ✅ Cliente agregado a lista negra
   - ✅ Aparece en la tabla

### 4.4 Validación en POS
1. Ir a `/pos`
2. Intentar hacer venta a CRÉDITO con cliente bloqueado
3. **Verificar:**
   - ✅ Sistema bloquea la venta
   - ✅ Mensaje de error indica que cliente está en lista negra
   - ✅ Venta CONTADO sí está permitida

### 4.5 Remover de Lista Negra
1. En lista negra, hacer clic en "Remover"
2. Confirmar
3. **Verificar:**
   - ✅ Cliente removido
   - ✅ Puede hacer ventas a crédito nuevamente

---

## 5. PRUEBAS DE SIDEBAR

### 5.1 Navegación
1. Verificar estructura del sidebar:
   - **VENTAS:** POS, Historial de Ventas, Devoluciones
   - **FINANZAS:** Caja, Deuda, Cobranzas
   - **CLIENTES:** Lista, Dashboard CRM, Lista Negra, Mapa
   - **INVENTARIO:** Stock, Movimientos, Ingreso Masivo
   - **CATÁLOGOS:** Productos, Visual, Líneas, Categorías, Marcas, Tallas, Proveedores
   - **REPORTES**

2. **Verificar:**
   - ✅ Todos los enlaces funcionan
   - ✅ Submenús se expanden/colapsan
   - ✅ Iconos correctos
   - ✅ Resaltado de página activa

### 5.2 Colapsar/Expandir
1. Hacer clic en "Colapsar menú" (abajo del sidebar)
2. **Verificar:**
   - ✅ Sidebar se reduce a iconos
   - ✅ Al pasar mouse, se expande temporalmente
   - ✅ Botón cambia a "Expandir menú"

---

## 6. PRUEBAS DE DASHBOARD

### 6.1 Enlace a Historial
1. Navegar a `/dashboard`
2. Hacer clic en card "Ventas Hoy"
3. **Verificar:**
   - ✅ Redirige a `/sales` (Historial de Ventas)
   - ✅ NO redirige a `/pos`

---

## 7. PRUEBAS DE INTEGRACIÓN

### 7.1 Flujo Completo: Venta → PDF → Devolución
1. Crear venta en POS
2. Descargar PDF del ticket
3. Ir a Historial de Ventas
4. Verificar que aparece la venta
5. Descargar PDF desde historial
6. Ir a Devoluciones
7. Crear devolución de esa venta
8. Aprobar devolución
9. **Verificar:**
   - ✅ Todo el flujo funciona sin errores
   - ✅ Datos consistentes en todas las pantallas

### 7.2 Flujo: Cliente Bloqueado
1. Agregar cliente a lista negra
2. Intentar venta a crédito en POS
3. Verificar bloqueo
4. Remover de lista negra
5. Intentar venta nuevamente
6. **Verificar:**
   - ✅ Bloqueo funciona correctamente
   - ✅ Remoción funciona correctamente

---

## 8. CHECKLIST FINAL

### Migraciones SQL
- [ ] Ejecutar `20260306000001_add_blacklist_fields.sql`
- [ ] Ejecutar `20260307000000_create_returns_table.sql`

### Funcionalidades
- [ ] PDF de tickets funciona correctamente
- [ ] Historial de ventas muestra datos correctos
- [ ] Devoluciones se pueden crear y gestionar
- [ ] Lista negra bloquea ventas a crédito
- [ ] Sidebar reorganizado correctamente
- [ ] Dashboard redirige a historial

### Diseño
- [ ] PDF tiene formato 80mm
- [ ] Logo aparece correctamente
- [ ] Tabla sin fondo negro
- [ ] QR code tamaño correcto (60x60pt)
- [ ] Cuotas aparecen en ventas a crédito
- [ ] No hay espacios en blanco excesivos

---

## NOTAS IMPORTANTES

1. **Playwright MCP no está conectado**: Las pruebas deben hacerse manualmente
2. **Servidor corriendo**: http://localhost:3000
3. **Migraciones pendientes**: Ejecutar en Supabase antes de probar
4. **Impresión directa**: Usar botón PDF en lugar de Imprimir para mejor resultado
5. **Cuotas por defecto**: Si no está especificado en BD, usa 6 cuotas

---

## PROBLEMAS CONOCIDOS Y SOLUCIONES

### PDF no descarga
- Verificar que el servidor esté corriendo
- Revisar consola del navegador para errores
- Verificar que la venta existe en la base de datos

### Devoluciones no aparecen
- Ejecutar migración SQL primero
- Verificar permisos RLS en Supabase
- Revisar consola para errores

### Cliente bloqueado puede hacer ventas a crédito
- Ejecutar migración de lista negra
- Verificar que el campo `blacklisted` está en `true`
- Revisar validación en POS (líneas 428-438)

---

## CONTACTO Y SOPORTE

Si encuentras algún problema durante las pruebas:
1. Revisar consola del navegador (F12)
2. Revisar logs del servidor Next.js
3. Verificar que las migraciones SQL se ejecutaron correctamente
4. Verificar permisos RLS en Supabase
