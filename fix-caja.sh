#!/bin/bash

# ============================================================================
# Script de Corrección Automática: Sistema de Caja Múltiples Tiendas
# ============================================================================
# Este script ejecuta todos los pasos necesarios para habilitar la apertura
# de turnos de caja para múltiples tiendas simultáneamente
# ============================================================================

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Corrección: Sistema de Caja para Múltiples Tiendas           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Paso 1: Diagnóstico
echo "📋 Paso 1/3: Ejecutando diagnóstico..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx supabase db execute --file supabase/DIAGNOSTICO_CAJA.sql
echo ""
echo "✓ Diagnóstico completado"
echo ""

# Preguntar si continuar
read -p "¿Deseas continuar con la corrección? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[SsYy]$ ]]
then
    echo "❌ Operación cancelada"
    exit 1
fi

# Paso 2: Aplicar correcciones
echo ""
echo "🔧 Paso 2/3: Aplicando correcciones..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx supabase db execute --file supabase/FIX_CASH_SHIFTS_MULTI_STORE.sql
echo ""
echo "✓ Correcciones aplicadas"
echo ""

# Preguntar si cerrar turnos abiertos
read -p "¿Deseas cerrar todos los turnos abiertos actualmente? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[SsYy]$ ]]
then
    echo ""
    echo "🔒 Paso 3/3: Cerrando turnos abiertos..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    npx supabase db execute --file supabase/CLOSE_ALL_OPEN_SHIFTS.sql
    echo ""
    echo "✓ Turnos cerrados"
else
    echo ""
    echo "⏭️  Paso 3/3: Omitido (turnos no cerrados)"
fi

# Resumen final
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ CORRECCIÓN COMPLETADA                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Limpia el caché de tu navegador (Ctrl+Shift+Delete)"
echo "   2. Recarga la página /cash"
echo "   3. Intenta abrir turnos para ambas tiendas"
echo ""
echo "📚 Documentación:"
echo "   - GUIA_RAPIDA_CAJA.md - Guía de uso"
echo "   - RESUMEN_SOLUCION_CAJA.md - Resumen técnico"
echo "   - SOLUCION_CAJA_MULTIPLE_TIENDAS.md - Documentación completa"
echo ""
echo "🎯 Resultado esperado:"
echo "   ✓ Puedes abrir turno para TIENDA_HOMBRES"
echo "   ✓ Puedes abrir turno para TIENDA_MUJERES (simultáneamente)"
echo "   ✓ Ambos turnos son independientes"
echo ""
