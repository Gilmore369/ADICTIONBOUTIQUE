#!/bin/bash

# ============================================================================
# SCRIPT DE VALIDACIÓN POST-DEPLOY
# ============================================================================
# Ejecutar después del deploy para verificar que todo funciona
# ============================================================================

echo "🔍 VALIDANDO DEPLOY..."
echo "============================================================================"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# ============================================================================
# 1. VERIFICAR CONECTIVIDAD VPS
# ============================================================================

info "Verificando conectividad al VPS..."

if ssh -i /tmp/k.pem ubuntu@18.224.29.109 "echo 'Conexión exitosa'" > /dev/null 2>&1; then
    success "Conexión SSH al VPS establecida"
else
    error "No se puede conectar al VPS"
    exit 1
fi

# ============================================================================
# 2. VERIFICAR ESTADO DE LA APLICACIÓN
# ============================================================================

info "Verificando estado de la aplicación en VPS..."

ssh -i /tmp/k.pem ubuntu@18.224.29.109 << 'EOF'
cd /var/www/ADICTIONBOUTIQUE

echo "📁 Directorio actual:"
pwd

echo ""
echo "📦 Archivos principales:"
if [ -f "package.json" ]; then echo "✅ package.json"; else echo "❌ package.json"; fi
if [ -d "actions" ]; then echo "✅ actions/"; else echo "❌ actions/"; fi
if [ -d "components" ]; then echo "✅ components/"; else echo "❌ components/"; fi
if [ -d "lib" ]; then echo "✅ lib/"; else echo "❌ lib/"; fi
if [ -d "app" ]; then echo "✅ app/"; else echo "❌ app/"; fi
if [ -d "supabase" ]; then echo "✅ supabase/"; else echo "❌ supabase/"; fi
if [ -d ".next" ]; then echo "✅ .next/ (build)"; else echo "❌ .next/ (build)"; fi

echo ""
echo "🔧 Estado de PM2:"
pm2 list | grep -E "(adiction|boutique)" || echo "⚠️  No se encontró proceso de la aplicación"

echo ""
echo "🌐 Puerto 3000:"
if netstat -tulpn | grep :3000 > /dev/null; then
    echo "✅ Puerto 3000 en uso"
else
    echo "❌ Puerto 3000 no está en uso"
fi

echo ""
echo "📊 Uso de recursos:"
free -h | head -2
df -h / | tail -1
EOF

# ============================================================================
# 3. VERIFICAR URLs PÚBLICAS
# ============================================================================

info "Verificando URLs públicas..."

# Función para verificar URL
check_url() {
    local url=$1
    local name=$2
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
    
    if [ "$status" = "200" ]; then
        success "$name: $url (HTTP $status)"
    elif [ "$status" = "000" ]; then
        error "$name: $url (No responde/Timeout)"
    else
        warning "$name: $url (HTTP $status)"
    fi
}

check_url "https://adictionboutique.agsys.es/" "Adiction Boutique"
check_url "https://asistenciasboutique.agsys.es/" "Asistencias Boutique"

# ============================================================================
# 4. VERIFICAR LOGS RECIENTES
# ============================================================================

info "Verificando logs recientes..."

ssh -i /tmp/k.pem ubuntu@18.224.29.109 << 'EOF'
echo "📝 Últimos logs de PM2:"
pm2 logs adiction-boutique --lines 10 --nostream 2>/dev/null || echo "No hay logs disponibles"

echo ""
echo "🔍 Errores recientes:"
pm2 logs adiction-boutique --lines 50 --nostream 2>/dev/null | grep -i error | tail -5 || echo "No se encontraron errores recientes"
EOF

# ============================================================================
# 5. VERIFICAR FUNCIONALIDADES ESPECÍFICAS
# ============================================================================

info "Verificando funcionalidades específicas..."

ssh -i /tmp/k.pem ubuntu@18.224.29.109 << 'EOF'
cd /var/www/ADICTIONBOUTIQUE

echo "🗄️ Migraciones de código de barras:"
if [ -f "supabase/migrations/20260503000001_add_barcode_to_products.sql" ]; then
    echo "✅ Migración de código de barras presente"
else
    echo "❌ Migración de código de barras falta"
fi

echo ""
echo "🔧 Componentes actualizados:"
if grep -q "barcode" components/products/products-table.tsx 2>/dev/null; then
    echo "✅ Tabla de productos tiene campo barcode"
else
    echo "❌ Tabla de productos sin campo barcode"
fi

if grep -q "barcode" components/products/product-form.tsx 2>/dev/null; then
    echo "✅ Formulario de productos tiene campo barcode"
else
    echo "❌ Formulario de productos sin campo barcode"
fi
EOF

# ============================================================================
# 6. RESUMEN FINAL
# ============================================================================

echo ""
echo "============================================================================"
echo "📊 RESUMEN DE VALIDACIÓN"
echo "============================================================================"

info "Próximos pasos recomendados:"
echo "1. Probar login en las URLs"
echo "2. Crear un producto con código de barras"
echo "3. Verificar que no se pueden duplicar códigos"
echo "4. Probar una venta en el POS"
echo "5. Verificar sistema de caja"

echo ""
warning "Si encuentras problemas:"
echo "• Revisar logs: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'pm2 logs adiction-boutique'"
echo "• Reiniciar app: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'pm2 restart adiction-boutique'"
echo "• Verificar nginx: ssh -i /tmp/k.pem ubuntu@18.224.29.109 'sudo systemctl status nginx'"

echo ""
success "Validación completada!"
echo "============================================================================"