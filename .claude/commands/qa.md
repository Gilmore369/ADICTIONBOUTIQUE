# /qa — QA visual del ERP Adiction Boutique

Realiza un checklist de calidad recorriendo las secciones principales del sistema.

## Uso
`/qa` — QA completo (todas las secciones)
`/qa dark` — Solo verificar dark mode
`/qa [sección]` — QA de una sección específica

## Argumento: `$ARGUMENTS`

## QA completo — Checklist por sección

Para cada sección, verifica leyendo el código fuente de los componentes:

### 🏠 Dashboard
- [ ] KPI cards muestran datos con formato moneda (S/)
- [ ] Los números de "mora" usan Lima timezone (función `get_dashboard_metrics`)
- [ ] Skeleton de carga visible mientras carga
- [ ] Responsive en mobile

### 🛒 POS
- [ ] Búsqueda de productos funciona con debounce
- [ ] Selector de tipo de pago (CONTADO/CRÉDITO) visible
- [ ] Para CRÉDITO: selector de cliente + cuotas
- [ ] Para CONTADO: valida caja abierta antes de procesar
- [ ] idempotency_key en el submit del formulario
- [ ] Ticket de venta se genera al finalizar

### 📋 Ventas realizadas
- [ ] Listado con filtros de fecha y tienda
- [ ] Botón "Anular" disponible (voidSale)
- [ ] Botón "Reimprimir ticket"
- [ ] Ventas anuladas marcadas visualmente (tachado o badge "ANULADA")

### ↩️ Devoluciones
- [ ] Flujo completo: PENDIENTE → APROBAR/RECHAZAR → COMPLETAR
- [ ] Botones correctos según estado actual
- [ ] Muestra productos devueltos con nombre real (no UUID)

### 💵 Caja diaria
- [ ] Botón "Abrir caja" si no hay turno abierto
- [ ] Botón "Cerrar caja" si hay turno abierto
- [ ] Resumen de efectivo visible (ventas + cobros - gastos)
- [ ] Formulario de gastos funciona

### 👤 Clientes
- [ ] Rating A-E visible en la lista
- [ ] Filtro activo/inactivo funciona
- [ ] Lista negra accesible desde el menú
- [ ] Mapa de deudores carga con pins

### 💳 Cobranzas
- [ ] Registrar cobro: selector de cliente con deuda pendiente
- [ ] Monto aplicado correctamente (oldest-due-first)
- [ ] Historial muestra pagos anteriores
- [ ] Acciones de cobranza: MENSAJE_REDES disponible

### 📦 Inventario
- [ ] Stock filtrado por tienda correctamente
- [ ] Movimientos muestran tipo ENTRADA/SALIDA/AJUSTE
- [ ] Carga masiva: formulario de variantes funciona
- [ ] Stock bajo en dashboard coincide con `/inventory/stock`

### 📚 Catálogo
- [ ] Productos: filtro línea → categoría estricto (no muestra categorías de otra línea)
- [ ] ProductCreateModal: barcode field visible en tabla de variantes
- [ ] Toggle activos/inactivos funciona en todos los catálogos

### 📊 Reportes
- [ ] Card grid selector visible (NO dropdown)
- [ ] Deep-linking `/reports?tab=sales` pre-selecciona Ventas
- [ ] Exportar CSV/Excel/PDF funcionan
- [ ] Backup BD descarga Excel multi-hoja

### 👑 Administración
- [ ] Solo accesible con rol admin
- [ ] CRUD de usuarios funciona
- [ ] Logo se guarda y aparece en el sidebar (todas las cuentas)

## QA Dark Mode (`/qa dark`)

Recorre los componentes de cada sección buscando clases hardcoded:

```
Patrones problemáticos:
- bg-white (→ bg-card)
- bg-gray-50/100 (→ bg-muted)
- text-gray-900/800 (→ text-foreground)
- text-gray-500/600 (→ text-muted-foreground)
- border-gray-100/200 (→ border-border)
- bg-slate-900 solo (sin bg-white para light → usar bg-card)
```

Listar cada archivo y línea con clase hardcoded.

## Formato de salida
- ✅ Sección OK — todo bien
- ⚠️ Sección con advertencias — lista de issues menores
- ❌ Sección con bugs — lista de issues que rompen funcionalidad

Al final: **Resumen** con conteo total y recomendación de qué arreglar primero.
