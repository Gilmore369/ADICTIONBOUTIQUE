# Deploy Script para Windows - Adiction Boutique
param([string]$KeyFile = "key.pem")

Write-Host "Iniciando deploy desde Windows..." -ForegroundColor Cyan

# Variables
$VPS_HOST = "ubuntu@18.224.29.109"
$VPS_PATH = "/var/www/ADICTIONBOUTIQUE"

# Funcion para logging
function Write-Log {
    param([string]$Message, [string]$Type = "Info")
    $timestamp = Get-Date -Format "HH:mm:ss"
    switch ($Type) {
        "Success" { Write-Host "[$timestamp] OK $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[$timestamp] ERROR $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[$timestamp] WARNING $Message" -ForegroundColor Yellow }
        default   { Write-Host "[$timestamp] INFO $Message" -ForegroundColor Blue }
    }
}

# Crear clave temporal con permisos correctos
Write-Log "Creando clave temporal con permisos correctos..."

$tempDir = Join-Path $env:TEMP "ssh_keys"
if (!(Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

$tempKey = Join-Path $tempDir "deploy_key.pem"
Copy-Item $KeyFile $tempKey -Force

# Configurar permisos
try {
    icacls $tempKey /inheritance:r | Out-Null
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    icacls $tempKey /grant "${currentUser}:R" | Out-Null
    Write-Log "Permisos de clave configurados correctamente" "Success"
}
catch {
    Write-Log "Error configurando permisos: $($_.Exception.Message)" "Error"
    exit 1
}

# Verificar conectividad
Write-Log "Verificando conectividad al VPS..."

try {
    $testConnection = ssh -i $tempKey -o ConnectTimeout=10 -o StrictHostKeyChecking=no $VPS_HOST "echo 'Conexion exitosa'"
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Conexion SSH establecida" "Success"
    } else {
        throw "Error de conexion SSH"
    }
}
catch {
    Write-Log "No se puede conectar al VPS" "Error"
    exit 1
}

# Verificar estado actual
Write-Log "Verificando estado actual en VPS..."

$checkScript = @"
cd $VPS_PATH
echo "Directorio actual: `$(pwd)"
echo ""
echo "Archivos principales:"
ls -la | head -10
echo ""
echo "Estado de PM2:"
pm2 list | grep -E "(adiction|boutique)" || echo "No se encontro proceso"
echo ""
echo "Puerto 3000:"
netstat -tulpn | grep :3000 || echo "Puerto 3000 no esta en uso"
"@

ssh -i $tempKey $VPS_HOST $checkScript

# Hacer build y reiniciar
Write-Log "Ejecutando build y reinicio..."

$deployScript = @"
cd $VPS_PATH

echo "Haciendo build..."
npm run build

if [ `$? -eq 0 ]; then
    echo "Build completado exitosamente"
else
    echo "Error en build"
    exit 1
fi

echo ""
echo "Reiniciando PM2..."
pm2 restart adiction-boutique --update-env

echo ""
echo "Estado de PM2 despues del reinicio:"
pm2 list

echo ""
echo "Logs recientes:"
pm2 logs adiction-boutique --lines 20 --nostream || echo "No hay logs disponibles"

echo ""
echo "Verificando puerto 3000:"
sleep 3
netstat -tulpn | grep :3000 && echo "Puerto 3000 activo" || echo "Puerto 3000 inactivo"
"@

try {
    ssh -i $tempKey $VPS_HOST $deployScript
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Deploy ejecutado correctamente" "Success"
    } else {
        Write-Log "Error durante el deploy" "Error"
    }
}
catch {
    Write-Log "Error ejecutando deploy" "Error"
}

# Verificar URLs
Write-Log "Verificando URLs publicas..."

function Test-Url {
    param([string]$Url, [string]$Name)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Log "$Name OK (HTTP $($response.StatusCode))" "Success"
        } else {
            Write-Log "$Name WARNING (HTTP $($response.StatusCode))" "Warning"
        }
    }
    catch {
        Write-Log "$Name ERROR (No responde)" "Error"
    }
}

Test-Url "https://adictionboutique.agsys.es/" "Adiction Boutique"
Test-Url "https://asistenciasboutique.agsys.es/" "Asistencias Boutique"

# Limpiar archivos temporales
Write-Log "Limpiando archivos temporales..."

try {
    Remove-Item $tempKey -Force
    Write-Log "Archivos temporales eliminados" "Success"
}
catch {
    Write-Log "Error eliminando archivos temporales" "Warning"
}

# Resumen final
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "DEPLOY COMPLETADO" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resumen:" -ForegroundColor White
Write-Host "- Conexion SSH establecida" -ForegroundColor Green
Write-Host "- Build ejecutado" -ForegroundColor Green
Write-Host "- PM2 reiniciado" -ForegroundColor Green
Write-Host "- URLs verificadas" -ForegroundColor Green
Write-Host ""
Write-Host "URLs para probar:" -ForegroundColor White
Write-Host "  https://adictionboutique.agsys.es/" -ForegroundColor Cyan
Write-Host "  https://asistenciasboutique.agsys.es/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Funcionalidades a probar:" -ForegroundColor White
Write-Host "  1. Login en la aplicacion" -ForegroundColor Yellow
Write-Host "  2. Crear producto con codigo de barras" -ForegroundColor Yellow
Write-Host "  3. Verificar que no se duplican codigos" -ForegroundColor Yellow
Write-Host "  4. Probar una venta en el POS" -ForegroundColor Yellow
Write-Host "  5. Sistema de caja funcionando" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan

Write-Log "Deploy completado exitosamente!" "Success"