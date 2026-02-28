# Sistema de Reportes - Documentación

## Descripción General

Sistema completo de generación y exportación de reportes con múltiples tipos de análisis, filtros avanzados y visualizaciones gráficas.

## Características

### Formatos de Exportación
- **CSV**: Archivo de texto separado por comas
- **Excel**: Archivo .xlsx con formato profesional
- **PDF**: Documento PDF con tabla formateada

### Tipos de Reportes Disponibles

#### 📦 Inventario
1. **Rotación de Stock**
   - Análisis de rotación de inventario por producto
   - Muestra: productos vendidos, stock actual, índice de rotación
   - Gráfico: Top 10 productos con mayor rotación

2. **Valorización de Inventario**
   - Valor total del inventario por producto y categoría
   - Muestra: costo total, valor de venta, ganancia potencial
   - Gráfico: Valorización por categoría

3. **Stock Bajo**
   - Productos con stock bajo o agotado
   - Filtro: stock mínimo configurable
   - Muestra: productos que requieren reabastecimiento

4. **Kardex de Movimientos**
   - Historial completo de movimientos de inventario
   - Filtros: fecha, producto, almacén
   - Muestra: entradas, salidas, referencias

#### 💰 Ventas
5. **Ventas por Período**
   - Resumen de ventas por día, semana o mes
   - Filtros: rango de fechas
   - Gráfico: Tendencia de ventas en el tiempo

6. **Ventas por Producto**
   - Productos más vendidos y su rendimiento
   - Muestra: cantidad vendida, ingresos, ganancia, margen
   - Gráfico: Top 10 productos más vendidos

7. **Ventas por Categoría**
   - Análisis de ventas por categoría de producto
   - Muestra: rendimiento por categoría

8. **Crédito vs Contado**
   - Comparación entre ventas al crédito y contado
   - Muestra: distribución de tipos de venta

#### 🛒 Compras
9. **Compras por Proveedor**
   - Análisis de compras realizadas a cada proveedor
   - Filtros: fecha, proveedor específico
   - Gráfico: Compras por proveedor
   - Muestra: productos comprados, cantidades, costos

10. **Compras por Período**
    - Historial de compras en el tiempo
    - Filtros: rango de fechas

#### 👥 Clientes
11. **Clientes con Deuda**
    - Listado de clientes con saldo pendiente
    - Muestra: límite de crédito, crédito usado, disponible
    - Gráfico: Top 10 clientes con mayor deuda

12. **Cuotas Vencidas**
    - Cuotas vencidas por cliente
    - Muestra: monto pendiente, días de mora
    - Ordenado por antigüedad

13. **Efectividad de Cobranza**
    - Análisis de efectividad en gestión de cobranza
    - Muestra: tasa de recuperación

#### 💵 Financiero
14. **Margen de Ganancia**
    - Análisis de márgenes de ganancia por producto
    - Muestra: costo, precio, margen porcentual

15. **Flujo de Caja**
    - Ingresos y egresos en el período
    - Muestra: balance de efectivo

## Filtros Disponibles

### Filtros Generales
- **Fecha Inicio**: Fecha inicial del período
- **Fecha Fin**: Fecha final del período

### Filtros Específicos
- **Stock Mínimo**: Para reporte de stock bajo (default: 5)
- **Producto**: Filtrar por producto específico
- **Categoría**: Filtrar por categoría
- **Proveedor**: Filtrar por proveedor
- **Cliente**: Filtrar por cliente
- **Almacén**: Filtrar por almacén

## Visualizaciones

### Gráficos Disponibles
- **Gráficos de Barras**: Para comparaciones y rankings
- **Gráficos de Líneas**: Para tendencias en el tiempo
- **Gráficos Circulares**: Para distribuciones porcentuales

### Reportes con Visualización
- Rotación de Stock
- Valorización de Inventario
- Ventas por Producto
- Ventas por Período
- Compras por Proveedor
- Clientes con Deuda

## Uso

### Interfaz Mejorada

La interfaz de reportes está organizada por categorías con tarjetas visuales:
- **5 Categorías**: Inventario, Ventas, Compras, Clientes, Financiero
- **Selección Visual**: Cada categoría tiene su propia tarjeta con color distintivo
- **Visualización Primero**: Los gráficos se muestran ANTES de los datos tabulares
- **Exportación Fácil**: Botones de exportación siempre visibles en la parte superior

### Generar un Reporte

1. **Seleccionar Tipo de Reporte**
   - Navega a "Reportes" → "Generar Reportes"
   - Selecciona el tipo de reporte deseado
   - Lee la descripción para entender qué información proporciona

2. **Aplicar Filtros (Opcional)**
   - Click en "Mostrar Filtros"
   - Configura los filtros según tus necesidades
   - Los filtros varían según el tipo de reporte

3. **Generar**
   - Click en "Generar Reporte"
   - Espera a que se procesen los datos
   - Revisa los resultados en pantalla

4. **Exportar**
   - Selecciona el formato deseado (CSV, Excel o PDF)
   - El archivo se descargará automáticamente
   - El nombre incluye el tipo de reporte y la fecha

### Ejemplos de Uso

#### Ejemplo 1: Productos que necesitan reabastecimiento
```
Reporte: Stock Bajo
Filtros: Stock Mínimo = 10
Resultado: Lista de productos con menos de 10 unidades
Acción: Generar orden de compra
```

#### Ejemplo 2: Análisis de ventas del mes
```
Reporte: Ventas por Período
Filtros: Fecha Inicio = 01/01/2024, Fecha Fin = 31/01/2024
Resultado: Todas las ventas de enero
Exportar: Excel para análisis detallado
```

#### Ejemplo 3: Productos más rentables
```
Reporte: Ventas por Producto
Filtros: Último mes
Resultado: Ranking de productos por ganancia
Visualización: Gráfico de barras con top 10
```

#### Ejemplo 4: Gestión de cobranza
```
Reporte: Cuotas Vencidas
Resultado: Lista de cuotas vencidas ordenadas por antigüedad
Acción: Priorizar gestión de cobranza
```

## Librerías Utilizadas

- **xlsx**: Generación de archivos Excel
- **jspdf + jspdf-autotable**: Generación de PDFs
- **papaparse**: Generación de archivos CSV
- **recharts**: Visualización de gráficos

## Notas Técnicas

### Límites
- La tabla en pantalla muestra máximo 50 registros
- Los archivos exportados incluyen todos los registros
- Los gráficos muestran top 10 o top 8 según el tipo

### Rendimiento
- Los reportes se generan del lado del servidor
- Los datos se procesan en tiempo real
- Para períodos largos, el procesamiento puede tomar unos segundos

### Formato de Números
- Montos en soles (S/)
- Separador de miles: coma (,)
- Decimales: 2 dígitos
- Formato: 1,234.56

## Próximas Mejoras

- [ ] Programación de reportes automáticos
- [ ] Envío de reportes por email
- [ ] Reportes personalizados
- [ ] Comparación entre períodos
- [ ] Exportación a Google Sheets
- [ ] Dashboards interactivos
- [ ] Alertas automáticas
- [ ] Reportes consolidados multi-almacén
