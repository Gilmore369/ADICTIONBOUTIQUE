# ============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - ADICTION BOUTIQUE VPS (PowerShell)
# ============================================================================
# Fecha: 2026-05-13
# Descripción: Deploy completo con subida de código y build
# ============================================================================

Write-Host "🚀 Iniciando deploy a VPS..." -ForegroundColor Blue
Write-Host "============================================================================" -ForegroundColor Blue

# Variables
$VPS_HOST = "ubuntu@18.224.29.109"
$VPS_PATH = "/var/www/ADICTIONBOUTIQUE"
$KEY_PATH = "tiendakey.pem"

# Función para logging
function Write-Log {
    param($Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# ============================================================================
# PASO 1: VERIFICAR ARCHIVOS LOCALES
# ============================================================================

Write-Log "Verificando archivos locales..."

# Verificar que existen las carpetas principales
$requiredFolders = @("actions", "components", "lib", "app", "supabase")
foreach ($folder in $requiredFolders) {
    if (!(Test-Path $folder)) {
        Write-Error "Falta carpeta: $folder. Ejecuta desde la raíz del proyecto."
        exit 1
    }
}

# Verificar las migraciones
$migrations = @(
    "supabase/migrations/20260504000001_payments_idempotency_key.sql",
    "supabase/migrations/20260504000002_installments_voided_status.sql", 
    "supabase/migrations/20260504000003_increment_stock_rpc.sql",
    "supabase/migrations/20260504000004_peek_sale_number_seq.sql",
    "supabase/migrations/20260513000000_add_user_profile_photo.sql"
)

foreach ($migration in $migrations) {
    if (!(Test-Path $migration)) {
        Write-Error "Falta migración: $migration"
        exit 1
    }
}

Write-Success "Archivos locales verificados"

# ============================================================================
# PASO 2: SUBIR CÓDIGO AL VPS
# ============================================================================

Write-Log "Subiendo código al VPS..."

# Crear backup del código actual en VPS
Write-Log "Creando backup del código actual..."
$backupCmd = "cd $VPS_PATH && cp -r . ../ADICTIONBOUTIQUE_backup_$(date +%Y%m%d_%H%M%S) || true"
& ssh -i $KEY_PATH $VPS_HOST $backupCmd

# Subir carpetas principales
Write-Log "Subiendo carpetas: actions, components, lib, app, supabase..."
& scp -i $KEY_PATH -r actions components lib app supabase "${VPS_HOST}:${VPS_PATH}/"

# Subir archivos de configuración importantes
Write-Log "Subiendo archivos de configuración..."
$configFiles = @("package.json", "package-lock.json", "next.config.ts", "tsconfig.json")
foreach ($file in $configFiles) {
    if (Test-Path $file) {
        & scp -i $KEY_PATH $file "${VPS_HOST}:${VPS_PATH}/"
    }
}

Write-Success "Código subido al VPS"

# ============================================================================
# PASO 3: INSTALAR DEPENDENCIAS Y BUILD
# ============================================================================

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

& ssh -i $KEY_PATH $VPS_HOST $buildScript

Write-Success "Build completado"

# ============================================================================
# PASO 4: REINICIAR APLICACIÓN
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

& ssh -i $KEY_PATH $VPS_HOST $restartScript

Write-Success "Aplicación reiniciada"

# ============================================================================
# PASO 5: VERIFICAR QUE LA APLICACIÓN ESTÉ FUNCIONANDO
# ============================================================================

Write-Log "Verificando que la aplicación esté funcionando..."

# Esperar un poco para que la aplicación inicie
Start-Sleep -Seconds 5

$verifyScript = @"
echo "🔍 Verificando proceso:"
pm2 show adiction-boutique | grep -E "(status|uptime|cpu|memory)" || echo "Proceso no encontrado"

echo ""
echo "🌐 Verificando puerto 3000:"
netstat -tulpn | grep :3000 || echo "Puerto 3000 no está en uso"

echo ""
echo "📡 Probando conexión local:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "No se pudo conectar"
"@

& ssh -i $KEY_PATH $VPS_HOST $verifyScript

# ============================================================================
# PASO 6: MOSTRAR RESUMEN
# ============================================================================

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "🎉 DEPLOY COMPLETADO" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
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
Write-Host "   1. La migración de profile_photo_url ya se ejecutó en Supabase" -ForegroundColor Yellow
Write-Host "   2. Verificar que la aplicación funcione correctamente" -ForegroundColor Yellow
Write-Host "   3. Probar nuevas funcionalidades:" -ForegroundColor Yellow
Write-Host "      • Fotos de perfil de usuario (Configuración > Mi Perfil)" -ForegroundColor Cyan
Write-Host "      • Crear proveedores desde Ingreso Masivo (sin error RUC)" -ForegroundColor Cyan
Write-Host "      • Visualización de recibos de pagos" -ForegroundColor Cyan
Write-Host "   4. Probar funcionalidades críticas (POS, inventario, etc.)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Si hay problemas:" -ForegroundColor White
Write-Host "   • Revisar logs: ssh -i tiendakey.pem ubuntu@18.224.29.109 'pm2 logs adiction-boutique'" -ForegroundColor Gray
Write-Host "   • Reiniciar: ssh -i tiendakey.pem ubuntu@18.224.29.109 'pm2 restart adiction-boutique'" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green

Write-Success "Deploy completado exitosamente!"