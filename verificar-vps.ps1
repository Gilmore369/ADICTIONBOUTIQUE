# Script para verificar estado del VPS
param(
    [int]$Intervalo = 30,  # segundos entre verificaciones
    [int]$MaxIntentos = 10
)

Write-Host "Verificando estado del VPS..." -ForegroundColor Cyan
Write-Host "IP: 18.224.29.109" -ForegroundColor Yellow
Write-Host "Intervalo: $Intervalo segundos" -ForegroundColor Yellow
Write-Host "Max intentos: $MaxIntentos" -ForegroundColor Yellow
Write-Host ""

function Test-VPSConnectivity {
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    # Test ping
    Write-Host "[$timestamp] Probando ping..." -ForegroundColor Blue
    $pingResult = Test-Connection -ComputerName "18.224.29.109" -Count 1 -Quiet
    
    if ($pingResult) {
        Write-Host "[$timestamp] ✅ PING: OK" -ForegroundColor Green
        
        # Test SSH port
        Write-Host "[$timestamp] Probando puerto SSH (22)..." -ForegroundColor Blue
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.ConnectAsync("18.224.29.109", 22).Wait(5000)
            if ($tcpClient.Connected) {
                Write-Host "[$timestamp] ✅ SSH: Puerto 22 abierto" -ForegroundColor Green
                $tcpClient.Close()
                return $true
            } else {
                Write-Host "[$timestamp] ❌ SSH: Puerto 22 cerrado" -ForegroundColor Red
            }
        }
        catch {
            Write-Host "[$timestamp] ❌ SSH: No se puede conectar al puerto 22" -ForegroundColor Red
        }
    } else {
        Write-Host "[$timestamp] ❌ PING: No responde" -ForegroundColor Red
    }
    
    # Test web URLs
    Write-Host "[$timestamp] Probando URLs web..." -ForegroundColor Blue
    
    $urls = @(
        "https://adictionboutique.agsys.es/",
        "https://asistenciasboutique.agsys.es/"
    )
    
    foreach ($url in $urls) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 5 -UseBasicParsing
            Write-Host "[$timestamp] ✅ WEB: $url (HTTP $($response.StatusCode))" -ForegroundColor Green
        }
        catch {
            Write-Host "[$timestamp] ❌ WEB: $url (No responde)" -ForegroundColor Red
        }
    }
    
    return $false
}

# Verificación inicial
$intento = 1
$vpsOnline = $false

while ($intento -le $MaxIntentos -and -not $vpsOnline) {
    Write-Host ""
    Write-Host "==================== INTENTO $intento/$MaxIntentos ====================" -ForegroundColor Cyan
    
    $vpsOnline = Test-VPSConnectivity
    
    if ($vpsOnline) {
        Write-Host ""
        Write-Host "🎉 VPS ESTÁ ONLINE! Puedes proceder con el deploy." -ForegroundColor Green
        Write-Host ""
        Write-Host "Comandos para ejecutar:" -ForegroundColor Yellow
        Write-Host "  .\deploy-simple.ps1" -ForegroundColor Cyan
        Write-Host ""
        break
    } else {
        if ($intento -lt $MaxIntentos) {
            Write-Host ""
            Write-Host "⏳ VPS no responde. Esperando $Intervalo segundos..." -ForegroundColor Yellow
            Start-Sleep -Seconds $Intervalo
        }
    }
    
    $intento++
}

if (-not $vpsOnline) {
    Write-Host ""
    Write-Host "❌ VPS NO RESPONDE después de $MaxIntentos intentos" -ForegroundColor Red
    Write-Host ""
    Write-Host "Acciones recomendadas:" -ForegroundColor Yellow
    Write-Host "1. Verificar panel de control del proveedor VPS" -ForegroundColor White
    Write-Host "2. Revisar si la instancia está corriendo" -ForegroundColor White
    Write-Host "3. Verificar si cambió la IP pública" -ForegroundColor White
    Write-Host "4. Contactar soporte del proveedor si es necesario" -ForegroundColor White
    Write-Host ""
    Write-Host "Documentación: PROBLEMA_VPS_NO_RESPONDE.md" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Verificación completada." -ForegroundColor Cyan