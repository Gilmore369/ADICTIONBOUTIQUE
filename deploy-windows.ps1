# Deploy script para Windows
Write-Host "Iniciando deploy a VPS..." -ForegroundColor Green

# Variables
$VPS_HOST = "ubuntu@18.224.29.109"
$VPS_PATH = "/var/www/ADICTIONBOUTIQUE"
$KEY_PATH = "tiendakey.pem"

# Verificar que la clave existe
if (-not (Test-Path $KEY_PATH)) {
    Write-Host "No se encuentra la clave SSH: $KEY_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Conectando al VPS y actualizando codigo..." -ForegroundColor Yellow

# Comando SSH para hacer pull y rebuild
$sshCommand = "cd $VPS_PATH; git pull origin master; npm install; npm run build; pm2 restart adiction-boutique --update-env; pm2 list"

# Ejecutar comando SSH
ssh -i $KEY_PATH $VPS_HOST $sshCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy completado exitosamente!" -ForegroundColor Green
    Write-Host "Verifica en: https://adictionboutique.agsys.es/" -ForegroundColor Cyan
} else {
    Write-Host "Error en el deploy" -ForegroundColor Red
}