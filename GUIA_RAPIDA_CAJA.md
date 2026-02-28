# Guía Rápida: Gestión de Caja para Múltiples Tiendas

## 🎯 Objetivo
Como administrador, puedes abrir y gestionar turnos de caja para AMBAS tiendas simultáneamente:
- TIENDA_HOMBRES
- TIENDA_MUJERES

## 🚀 Solución Rápida (3 pasos)

### 1️⃣ Ejecutar Diagnóstico
```bash
npx supabase db execute --file supabase/DIAGNOSTICO_CAJA.sql
```
Este comando te mostrará:
- Turnos actualmente abiertos
- Restricciones que puedan estar bloqueando
- Estado de tu usuario admin
- Políticas de seguridad

### 2️⃣ Aplicar Corrección
```bash
npx supabase db execute --file supabase/FIX_CASH_SHIFTS_MULTI_STORE.sql
```
Este comando:
- Remueve restricciones que bloquean múltiples turnos
- Verifica que todo esté configurado correctamente

### 3️⃣ (Opcional) Cerrar Turnos Existentes
Si hay turnos abiertos que no deberían estar:
```bash
npx supabase db execute --file supabase/CLOSE_ALL_OPEN_SHIFTS.sql
```

### 4️⃣ Limpiar Caché del Navegador
- Presiona `Ctrl + Shift + Delete`
- Selecciona "Imágenes y archivos en caché"
- Haz clic en "Borrar datos"
- Recarga la página

## ✅ Cómo Usar

### Abrir Turno para Primera Tienda
1. Ve a `/cash`
2. Selecciona "Tienda de Hombres" (o Mujeres)
3. Ingresa el monto de apertura (ej: 100.00)
4. Haz clic en "Abrir Turno"

### Abrir Turno para Segunda Tienda
1. En la misma página, verás otro formulario debajo
2. Selecciona la otra tienda
3. Ingresa el monto de apertura
4. Haz clic en "Abrir Turno"

### Resultado
Verás ambos turnos abiertos en la parte superior, cada uno en su propia tarjeta:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ TIENDA_HOMBRES          │  │ TIENDA_MUJERES          │
│ [ABIERTO]               │  │ [ABIERTO]               │
│                         │  │                         │
│ Apertura: S/ 100.00     │  │ Apertura: S/ 150.00     │
│                         │  │                         │
│ [Cerrar Turno]          │  │ [Cerrar Turno]          │
│ [Registrar Gasto]       │  │ [Registrar Gasto]       │
└─────────────────────────┘  └─────────────────────────┘
```

## 🔍 Verificación

Para verificar que todo funciona:

```sql
-- Ver turnos abiertos
SELECT store_id, opening_amount, opened_at 
FROM cash_shifts 
WHERE status = 'OPEN';

-- Debe mostrar 2 filas (una por cada tienda)
```

## 📋 Archivos Creados

1. **DIAGNOSTICO_CAJA.sql** - Muestra el estado actual del sistema
2. **FIX_CASH_SHIFTS_MULTI_STORE.sql** - Corrige restricciones bloqueantes
3. **CLOSE_ALL_OPEN_SHIFTS.sql** - Cierra todos los turnos abiertos
4. **SOLUCION_CAJA_MULTIPLE_TIENDAS.md** - Documentación detallada

## ❓ Preguntas Frecuentes

### ¿Por qué no puedo abrir el segundo turno?
- Puede haber una restricción en la base de datos
- Ejecuta el script de diagnóstico para identificar el problema

### ¿Puedo tener más de 2 turnos abiertos?
- Sí, si tienes más tiendas
- El sistema permite un turno abierto por tienda

### ¿Qué pasa si cierro un turno por error?
- No se puede reabrir
- Debes abrir un nuevo turno

### ¿Los cajeros también pueden abrir ambas tiendas?
- No, los cajeros solo ven su tienda asignada
- Solo los administradores pueden gestionar ambas tiendas

## 🛠️ Soporte Técnico

Si después de seguir estos pasos aún tienes problemas:

1. Revisa los logs del navegador (F12 > Console)
2. Ejecuta el diagnóstico completo
3. Verifica que tu usuario tenga rol 'admin':
   ```sql
   SELECT email, roles FROM users WHERE email = 'gianpepex@gmail.com';
   ```

## 📝 Notas Importantes

- Cada tienda tiene su propio turno independiente
- Los gastos se registran por turno (no por tienda)
- Al cerrar un turno, se calcula automáticamente la diferencia
- Solo se cuentan las ventas en EFECTIVO (no las de crédito)
