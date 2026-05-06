#!/bin/bash

# ============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - ADICTION BOUTIQUE VPS
# ============================================================================
# Fecha: 2026-05-04
# Descripción: Deploy completo con subida de código y build
# ============================================================================

set -e  # Exit on any error

echo "🚀 Iniciando deploy a VPS..."
echo "============================================================================"

# Variables
VPS_HOST="ubuntu@18.224.29.109"
VPS_PATH="/var/www/ADICTIONBOUTIQUE"
KEY_PATH="/tmp/k.pem"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================================================
# PASO 1: VERIFICAR ARCHIVOS LOCALES
# ============================================================================

log "Verificando archivos locales..."

# Verificar que existen las carpetas principales
if [ ! -d "actions" ] || [ ! -d "components" ] || [ ! -d "lib" ] || [ ! -d "app" ] || [ ! -d "supabase" ]; then
    error "Faltan carpetas principales. Ejecuta desde la raíz del proyecto."
    exit 1
fi

# Verificar las 4 migraciones nuevas
MIGRATIONS=(
    "supabase/migrations/20260504000001_payments_idempotency_key.sql"
    "supabase/migrations/20260504000002_installments_voided_status.sql"
    "supabase/migrations/20260504000003_increment_stock_rpc.sql"
    "supabase/migrations/20260504000004_peek_sale_number_seq.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    if [ ! -f "$migration" ]; then
        error "Falta migración: $migration"
        exit 1
    fi
done

success "Archivos locales verificados"

# ============================================================================
# PASO 2: SUBIR CÓDIGO AL VPS
# ============================================================================

log "Subiendo código al VPS..."

# Crear backup del código actual en VPS
log "Creando backup del código actual..."
ssh -i "$KEY_PATH" "$VPS_HOST" "cd $VPS_PATH && cp -r . ../ADICTIONBOUTIQUE_backup_$(date +%Y%m%d_%H%M%S) || true"

# Subir carpetas principales
log "Subiendo carpetas: actions, components, lib, app, supabase..."
scp -i "$KEY_PATH" -r actions components lib app supabase "$VPS_HOST:$VPS_PATH/"

# Subir archivos de configuración importantes
log "Subiendo archivos de configuración..."
scp -i "$KEY_PATH" package.json package-lock.json next.config.ts tsconfig.json "$VPS_HOST:$VPS_PATH/" || true

success "Código subido al VPS"

# ============================================================================
# PASO 3: VERIFICAR ESTADO EN VPS
# ============================================================================

log "Verificando estado en VPS..."

ssh -i "$KEY_PATH" "$VPS_HOST" << 'EOF'
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
    if [ -f "$migration" ]; then
        echo "✅ $migration"
    else
        echo "❌ $migration - FALTA"
    fi
done

echo ""
echo "🔧 Verificando PM2:"
pm2 list | grep adiction || echo "⚠️  Proceso adiction no encontrado en PM2"
EOF

success "Verificación completada"

# ============================================================================
# PASO 4: INSTALAR DEPENDENCIAS Y BUILD
# ============================================================================

log "Instalando dependencias y haciendo build..."

ssh -i "$KEY_PATH" "$VPS_HOST" << 'EOF'
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
EOF

success "Build completado"

# ============================================================================
# PASO 5: REINICIAR APLICACIÓN
# ============================================================================

log "Reiniciando aplicación..."

ssh -i "$KEY_PATH" "$VPS_HOST" << 'EOF'
cd /var/www/ADICTIONBOUTIQUE

echo "🔄 Reiniciando PM2..."
pm2 restart adiction-boutique --update-env || pm2 start npm --name "adiction-boutique" -- start

echo ""
echo "📊 Estado de PM2:"
pm2 list

echo ""
echo "📝 Logs recientes:"
pm2 logs adiction-boutique --lines 10 --nostream || echo "No hay logs disponibles"
EOF

success "Aplicación reiniciada"

# ============================================================================
# PASO 6: VERIFICAR QUE LA APLICACIÓN ESTÉ FUNCIONANDO
# ============================================================================

log "Verificando que la aplicación esté funcionando..."

# Esperar un poco para que la aplicación inicie
sleep 5

# Verificar que el proceso esté corriendo
ssh -i "$KEY_PATH" "$VPS_HOST" << 'EOF'
echo "🔍 Verificando proceso:"
pm2 show adiction-boutique | grep -E "(status|uptime|cpu|memory)" || echo "Proceso no encontrado"

echo ""
echo "🌐 Verificando puerto 3000:"
netstat -tulpn | grep :3000 || echo "Puerto 3000 no está en uso"

echo ""
echo "📡 Probando conexión local:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "No se pudo conectar"
EOF

# ============================================================================
# PASO 7: MOSTRAR RESUMEN
# ============================================================================

echo ""
echo "============================================================================"
echo "🎉 DEPLOY COMPLETADO"
echo "============================================================================"
echo ""
echo "📋 Resumen:"
echo "✅ Código subido al VPS"
echo "✅ Dependencias instaladas"
echo "✅ Build completado"
echo "✅ Aplicación reiniciada"
echo ""
echo "🌐 URLs para verificar:"
echo "   • https://adictionboutique.agsys.es/"
echo "   • https://asistenciasboutique.agsys.es/"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Ejecutar las 4 migraciones en Supabase Dashboard"
echo "   2. Verificar que la aplicación funcione correctamente"
echo "   3. Probar funcionalidades críticas (POS, inventario, etc.)"
echo ""
echo "🔧 Si hay problemas:"
echo "   • Revisar logs: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'pm2 logs adiction-boutique'"
echo "   • Reiniciar: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'pm2 restart adiction-boutique'"
echo ""
echo "============================================================================"

success "Deploy completado exitosamente! 🚀"