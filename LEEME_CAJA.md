# 🎯 Solución: Apertura de Caja para Múltiples Tiendas

## ⚡ Solución Rápida (1 comando)

### Windows (PowerShell)
```powershell
.\fix-caja.ps1
```

### Linux/Mac (Bash)
```bash
./fix-caja.sh
```

Este script ejecutará automáticamente:
1. ✅ Diagnóstico del sistema
2. ✅ Corrección de restricciones
3. ✅ (Opcional) Cierre de turnos abiertos

## 📋 Problema

Como usuario administrador, no puedes abrir turnos de caja para ambas tiendas simultáneamente:
- TIENDA_HOMBRES
- TIENDA_MUJERES

Error recibido: "Ya hay un turno abierto para esta tienda"

## ✅ Solución

El sistema ahora permite:
- ✅ Abrir turno para TIENDA_HOMBRES
- ✅ Abrir turno para TIENDA_MUJERES (al mismo tiempo)
- ✅ Gestionar ambos turnos independientemente
- ✅ Cerrar cada turno por separado

## 🚀 Pasos Manuales (si prefieres)

### 1. Diagnóstico
```bash
npx supabase db execute --file supabase/DIAGNOSTICO_CAJA.sql
```

### 2. Corrección
```bash
npx supabase db execute --file supabase/FIX_CASH_SHIFTS_MULTI_STORE.sql
```

### 3. (Opcional) Cerrar Turnos
```bash
npx supabase db execute --file supabase/CLOSE_ALL_OPEN_SHIFTS.sql
```

### 4. Limpiar Caché
- Presiona `Ctrl + Shift + Delete`
- Selecciona "Imágenes y archivos en caché"
- Borra y recarga la página

## 📚 Documentación

| Archivo | Descripción |
|---------|-------------|
| **GUIA_RAPIDA_CAJA.md** | Guía paso a paso con ejemplos visuales |
| **RESUMEN_SOLUCION_CAJA.md** | Resumen técnico de la solución |
| **SOLUCION_CAJA_MULTIPLE_TIENDAS.md** | Documentación técnica completa |

## 🔧 Scripts SQL

| Script | Propósito |
|--------|-----------|
| `DIAGNOSTICO_CAJA.sql` | Muestra el estado actual del sistema |
| `FIX_CASH_SHIFTS_MULTI_STORE.sql` | Corrige restricciones bloqueantes |
| `CLOSE_ALL_OPEN_SHIFTS.sql` | Cierra todos los turnos abiertos |

## 🎯 Resultado Esperado

Después de ejecutar la solución:

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

## ✨ Características

- ✅ Un turno abierto por tienda
- ✅ Admin gestiona todas las tiendas
- ✅ Turnos independientes
- ✅ Cierres de caja separados
- ✅ Control de efectivo por tienda

## 🆘 Soporte

Si tienes problemas:

1. Ejecuta el diagnóstico: `npx supabase db execute --file supabase/DIAGNOSTICO_CAJA.sql`
2. Busca "PROBLEMA" en la salida
3. Revisa la consola del navegador (F12)
4. Verifica que estás usando el usuario admin: `gianpepex@gmail.com`
5. Limpia el caché del navegador

## 📞 Contacto

Usuario: gianpepex@gmail.com
Rol: admin
Tiendas: TIENDA_HOMBRES, TIENDA_MUJERES

---

**Última actualización**: 2026-02-22
