# Módulo de Caja - Instrucciones

## 📦 Archivos Creados

### Backend (Actions)
- `actions/cash.ts` - Acciones del servidor para gestión de caja

### Frontend (UI)
- `app/(auth)/cash/page.tsx` - Página principal del módulo de caja
- `components/cash/cash-shift-manager.tsx` - Componente de gestión de turnos

### Base de Datos
- `supabase/seed_data_3_months.sql` - Script para generar datos de prueba (3 meses)

## 🚀 Pasos para Activar el Módulo

### 1. Ejecutar Migraciones (si no lo has hecho)

Las tablas `cash_shifts` y `cash_expenses` ya deberían existir. Verifica ejecutando:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('cash_shifts', 'cash_expenses');
```

### 2. Generar Datos de Prueba

Ejecuta el script en el SQL Editor de Supabase:

```bash
# Copia el contenido de supabase/seed_data_3_months.sql
# y pégalo en el SQL Editor de Supabase
```

Este script generará:
- ✅ 50 clientes
- ✅ 100 productos
- ✅ ~900 ventas (10 por día x 90 días)
- ✅ Planes de crédito e installments
- ✅ Pagos parciales y completos
- ✅ Turnos de caja diarios (3 tiendas x 90 días = 270 turnos)
- ✅ Gastos de caja aleatorios

**Período de datos:** Diciembre 2025 - Febrero 2026

### 3. Actualizar Rol de Usuario

Asegúrate de que tu usuario tenga el rol correcto:

```sql
-- Ver tu usuario
SELECT id, email, roles FROM users WHERE email = 'tu-email@ejemplo.com';

-- Actualizar rol (debe incluir 'admin' o 'cajero' para acceder al módulo)
UPDATE users 
SET roles = ARRAY['admin', 'cajero']
WHERE email = 'tu-email@ejemplo.com';
```

### 4. Agregar Ruta al Menú de Navegación

Edita tu componente de navegación para agregar el enlace al módulo de caja:

```tsx
{
  title: "Caja",
  href: "/cash",
  icon: DollarSign, // Importa desde lucide-react
}
```

## 🎯 Funcionalidades del Módulo

### Apertura de Turno
1. Selecciona la tienda
2. Ingresa el monto inicial en caja
3. Click en "Abrir Turno"

### Registro de Gastos
1. Con un turno abierto, ve a la pestaña "Gastos"
2. Ingresa monto, categoría y descripción
3. Click en "Registrar Gasto"

Categorías disponibles:
- SERVICIOS
- MANTENIMIENTO
- SUMINISTROS
- TRANSPORTE
- OTROS

### Cierre de Turno
1. Ve a la pestaña "Cerrar Turno"
2. Revisa el resumen:
   - Monto Inicial
   - Gastos del día
   - Monto Esperado
3. Ingresa el monto real contado en caja
4. El sistema calcula automáticamente la diferencia
5. Click en "Cerrar Turno"

## 📊 Métricas Disponibles

Con los datos generados podrás:
- Ver ventas diarias/mensuales
- Analizar diferencias de caja
- Exportar reportes de gastos
- Revisar histórico de turnos
- Identificar patrones de ventas

## 🏪 Tiendas Configuradas

El sistema incluye 3 tiendas por defecto:
- TIENDA_1: Tienda Principal
- TIENDA_2: Sucursal Norte
- TIENDA_3: Sucursal Sur

Para agregar más tiendas, edita el array `STORES` en:
`components/cash/cash-shift-manager.tsx`

## 🔐 Permisos

Roles con acceso al módulo:
- `admin` - Acceso completo
- `cajero` - Acceso completo

Para agregar el rol cajero a un usuario:

```sql
UPDATE users 
SET roles = ARRAY['cajero']
WHERE email = 'cajero@ejemplo.com';
```

## 📝 Notas Importantes

1. **Solo un turno abierto por tienda:** No se puede abrir un nuevo turno si ya existe uno abierto para la misma tienda.

2. **Cálculo automático:** El monto esperado se calcula como:
   ```
   Monto Esperado = Monto Inicial - Total Gastos
   ```

3. **Diferencia de caja:** Se calcula como:
   ```
   Diferencia = Monto Real - Monto Esperado
   ```
   - Positivo = Sobrante
   - Negativo = Faltante

4. **Datos de prueba:** Los datos generados son ficticios pero realistas, con:
   - Ventas distribuidas aleatoriamente
   - 70% ventas en efectivo, 30% a crédito
   - Gastos operativos aleatorios
   - Pagos parciales y completos de créditos

## 🐛 Troubleshooting

### Error: "Ya existe un turno abierto"
- Cierra el turno existente antes de abrir uno nuevo
- O consulta: `SELECT * FROM cash_shifts WHERE status = 'OPEN' AND store_id = 'TIENDA_1';`

### No puedo acceder al módulo
- Verifica que tu usuario tenga el rol `admin` o `cajero`
- Ejecuta: `SELECT roles FROM users WHERE email = 'tu-email@ejemplo.com';`

### Los datos no se generaron
- Verifica que las tablas existan
- Revisa los logs del SQL Editor
- Asegúrate de tener al menos un usuario con rol admin

## 📧 Soporte

Si encuentras algún problema, revisa:
1. Logs del servidor Next.js
2. Consola del navegador
3. Logs de Supabase
