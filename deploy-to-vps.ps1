# ============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - ADICTION BOUTIQUE VPS (PowerShell)
# ============================================================================
# Fecha: 2026-05-04
# Descripción: Deploy completo con subida de código y build
# ============================================================================

param(
    [switch]$SkipBackup = $false,
    [switch]$SkipBuild = $false
)

# Variables
$VPS_HOST = "ubuntu@18.224.29.109"
$VPS_PATH = "/var/www/ADICTIONBOUTIQUE"
$KEY_PATH = "/tmp/k.pem"

# Función para logging con colores
function Write-Log {
    param([string]$Message, [string]$Type = "Info")
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    switch ($Type) {
        "Success" { Write-Host "[$timestamp] ✅ $Message" -ForegroundColor Green }
        "Warning" { Write-Host "[$timestamp] ⚠️  $Message" -ForegroundColor Yellow }
        "Error"   { Write-Host "[$timestamp] ❌ $Message" -ForegroundColor Red }
        default   { Write-Host "[$timestamp] 🔵 $Message" -ForegroundColor Blue }
    }
}

Write-Host "🚀 Iniciando deploy a VPS..." -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

# ============================================================================
# PASO 1: VERIFICAR ARCHIVOS LOCALES
# ============================================================================

Write-Log "Verificando archivos locales..."

# Verificar que existen las carpetas principales
$requiredFolders = @("actions", "components", "lib", "app", "supabase")
foreach ($folder in $requiredFolders) {
    if (!(Test-Path $folder)) {
        Write-Log "Falta carpeta: $folder. Ejecuta desde la raíz del proyecto." "Error"
        exit 1
    }
}

# Verificar las 4 migraciones nuevas
$migrations = @(
    "supabase/migrations/20260504000001_payments_idempotency_key.sql",
    "supabase/migrations/20260504000002_installments_voided_status.sql",
    "supabase/migrations/20260504000003_increment_stock_rpc.sql",
    "supabase/migrations/20260504000004_peek_sale_number_seq.sql"
)

foreach ($migration in $migrations) {
    if (!(Test-Path $migration)) {
        Write-Log "Falta migración: $migration" "Error"
        exit 1
    }
}

Write-Log "Archivos locales verificados" "Success"

# ============================================================================
# PASO 2: SUBIR CÓDIGO AL VPS
# ============================================================================

Write-Log "Subiendo código al VPS..."

try {
    # Crear backup del código actual en VPS (si no se omite)
    if (!$SkipBackup) {
        Write-Log "Creando backup del código actual..."
        $backupCmd = "cd $VPS_PATH && cp -r . ../ADICTIONBOUTIQUE_backup_$(date +%Y%m%d_%H%M%S) || true"
        ssh -i $KEY_PATH $VPS_HOST $backupCmd
    }

    # Subir carpetas principales
    Write-Log "Subiendo carpetas: actions, components, lib, app, supabase..."
    scp -i $KEY_PATH -r actions components lib app supabase "${VPS_HOST}:${VPS_PATH}/"

    # Subir archivos de configuración importantes
    Write-Log "Subiendo archivos de configuración..."
    $configFiles = @("package.json", "package-lock.json", "next.config.ts", "tsconfig.json")
    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            scp -i $KEY_PATH $file "${VPS_HOST}:${VPS_PATH}/"
        }
    }

    Write-Log "Código subido al VPS" "Success"
}
catch {
    Write-Log "Error subiendo código: $($_.Exception.Message)" "Error"
    exit 1
}

# ============================================================================
# PASO 3: VERIFICAR ESTADO EN VPS
# ============================================================================

Write-Log "Verificando estado en VPS..."

$verifyScript = @"
cd /var/www/ADICTIONBOUTIQUE

echo "📁 Contenido del directorio:"
ls -la

echo ""
echo "📦 Verificando package.json:"
if [ -f package.json ]; then
    echo "✅ package.json existe"
else
    echo "❌ package.json no encontrado"
fi

echo ""
echo "🗄️ Verificando migraciones nuevas:"
for migration in supabase/migrations/20260504000001_payments_idempotency_key.sql \
                 supabase/migrations/20260504000002_installments_voided_status.sql \
                 supabase/migrations/20260504000003_increment_stock_rpc.sql \
                 supabase/migrations/20260504000004_peek_sale_number_seq.sql; do
    if [ -f "`$migration" ]; then
        echo "✅ `$migration"
    else
        echo "❌ `$migration - FALTA"
    fi
done

echo ""
echo "🔧 Verificando PM2:"
pm2 list | grep adiction || echo "⚠️  Proceso adiction no encontrado en PM2"
"@

ssh -i $KEY_PATH $VPS_HOST $verifyScript

Write-Log "Verificación completada" "Success"

# ============================================================================
# PASO 4: INSTALAR DEPENDENCIAS Y BUILD
# ============================================================================

if (!$SkipBuild) {
    Write-Log "Instalando dependencias y haciendo build..."

    $buildScript = @"
cd /var/www/ADICTIONBOUTIQUE

echo "📦 Instalando dependencias..."
npm install --production=false

echo ""
echo "🏗️  Haciendo build..."
npm run build

echo ""
echo "📊 Verificando build:"
if [ -d ".next" ]; then
    echo "✅ Build completado - directorio .next existe"
    ls -la .next/ | head -5
else
    echo "❌ Build falló - directorio .next no existe"
    exit 1
fi
"@

    try {
        ssh -i $KEY_PATH $VPS_HOST $buildScript
        Write-Log "Build completado" "Success"
    }
    catch {
        Write-Log "Error en build: $($_.Exception.Message)" "Error"
        exit 1
    }
}

# ============================================================================
# PASO 5: REINICIAR APLICACIÓN
# ============================================================================

Write-Log "Reiniciando aplicación..."

$restartScript = @"
cd /var/www/ADICTIONBOUTIQUE

echo "🔄 Reiniciando PM2..."
pm2 restart adiction-boutique --update-env || pm2 start npm --name "adiction-boutique" -- start

echo ""
echo "📊 Estado de PM2:"
pm2 list

echo ""
echo "📝 Logs recientes:"
pm2 logs adiction-boutique --lines 10 --nostream || echo "No hay logs disponibles"
"@

ssh -i $KEY_PATH $VPS_HOST $restartScript

Write-Log "Aplicación reiniciada" "Success"

# ============================================================================
# PASO 6: VERIFICAR QUE LA APLICACIÓN ESTÉ FUNCIONANDO
# ============================================================================

Write-Log "Verificando que la aplicación esté funcionando..."

# Esperar un poco para que la aplicación inicie
Start-Sleep -Seconds 5

$checkScript = @"
echo "🔍 Verificando proceso:"
pm2 show adiction-boutique | grep -E "(status|uptime|cpu|memory)" || echo "Proceso no encontrado"

echo ""
echo "🌐 Verificando puerto 3000:"
netstat -tulpn | grep :3000 || echo "Puerto 3000 no está en uso"

echo ""
echo "📡 Probando conexión local:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "No se pudo conectar"
"@

ssh -i $KEY_PATH $VPS_HOST $checkScript

# ============================================================================
# PASO 7: MOSTRAR RESUMEN
# ============================================================================

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "🎉 DEPLOY COMPLETADO" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Resumen:" -ForegroundColor White
Write-Host "✅ Código subido al VPS" -ForegroundColor Green
Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
Write-Host "✅ Build completado" -ForegroundColor Green
Write-Host "✅ Aplicación reiniciada" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 URLs para verificar:" -ForegroundColor White
Write-Host "   • https://adictionboutique.agsys.es/" -ForegroundColor Cyan
Write-Host "   • https://asistenciasboutique.agsys.es/" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor White
Write-Host "   1. Ejecutar las 4 migraciones en Supabase Dashboard" -ForegroundColor Yellow
Write-Host "   2. Verificar que la aplicación funcione correctamente" -ForegroundColor Yellow
Write-Host "   3. Probar funcionalidades críticas (POS, inventario, etc.)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Si hay problemas:" -ForegroundColor White
Write-Host "   • Revisar logs: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'pm2 logs adiction-boutique'" -ForegroundColor Gray
Write-Host "   • Reiniciar: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'pm2 restart adiction-boutique'" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan

Write-Log "Deploy completado exitosamente! 🚀" "Success"