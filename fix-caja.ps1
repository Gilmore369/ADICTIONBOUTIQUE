# ============================================================================
# Script de Corrección Automática: Sistema de Caja Múltiples Tiendas
# ============================================================================
# Este script ejecuta todos los pasos necesarios para habilitar la apertura
# de turnos de caja para múltiples tiendas simultáneamente
# ============================================================================

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Corrección: Sistema de Caja para Múltiples Tiendas           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Diagnóstico
Write-Host "📋 Paso 1/3: Ejecutando diagnóstico..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
npx supabase db execute --file supabase/DIAGNOSTICO_CAJA.sql
Write-Host ""
Write-Host "✓ Diagnóstico completado" -ForegroundColor Green
Write-Host ""

# Preguntar si continuar
$continue = Read-Host "¿Deseas continuar con la corrección? (s/n)"
if ($continue -notmatch '^[SsYy]$') {
    Write-Host "❌ Operación cancelada" -ForegroundColor Red
    exit 1
}

# Paso 2: Aplicar correcciones
Write-Host ""
Write-Host "🔧 Paso 2/3: Aplicando correcciones..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
npx supabase db execute --file supabase/FIX_CASH_SHIFTS_MULTI_STORE.sql
Write-Host ""
Write-Host "✓ Correcciones aplicadas" -ForegroundColor Green
Write-Host ""

# Preguntar si cerrar turnos abiertos
$closeShifts = Read-Host "¿Deseas cerrar todos los turnos abiertos actualmente? (s/n)"
if ($closeShifts -match '^[SsYy]$') {
    Write-Host ""
    Write-Host "🔒 Paso 3/3: Cerrando turnos abiertos..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    npx supabase db execute --file supabase/CLOSE_ALL_OPEN_SHIFTS.sql
    Write-Host ""
    Write-Host "✓ Turnos cerrados" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⏭️  Paso 3/3: Omitido (turnos no cerrados)" -ForegroundColor Gray
}

# Resumen final
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ CORRECCIÓN COMPLETADA                                      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Limpia el caché de tu navegador (Ctrl+Shift+Delete)"
Write-Host "   2. Recarga la página /cash"
Write-Host "   3. Intenta abrir turnos para ambas tiendas"
Write-Host ""
Write-Host "📚 Documentación:" -ForegroundColor Cyan
Write-Host "   - GUIA_RAPIDA_CAJA.md - Guía de uso"
Write-Host "   - RESUMEN_SOLUCION_CAJA.md - Resumen técnico"
Write-Host "   - SOLUCION_CAJA_MULTIPLE_TIENDAS.md - Documentación completa"
Write-Host ""
Write-Host "🎯 Resultado esperado:" -ForegroundColor Cyan
Write-Host "   ✓ Puedes abrir turno para TIENDA_HOMBRES" -ForegroundColor Green
Write-Host "   ✓ Puedes abrir turno para TIENDA_MUJERES (simultáneamente)" -ForegroundColor Green
Write-Host "   ✓ Ambos turnos son independientes" -ForegroundColor Green
Write-Host ""
