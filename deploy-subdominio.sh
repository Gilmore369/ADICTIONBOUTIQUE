#!/bin/bash

# Script de despliegue para ADICTION BOUTIQUE en subdominio
# Subdominio: adictionboutique.agsys.es
# Puerto: 4000

set -e

echo "🚀 Desplegando ADICTION BOUTIQUE en adictionboutique.agsys.es..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    print_error "Error: No se encuentra package.json. Ejecuta este script desde /var/www/ADICTIONBOUTIQUE"
    exit 1
fi

# 1. Pull últimos cambios
print_message "Obteniendo últimos cambios del repositorio..."
git pull origin main

# 2. Instalar/actualizar dependencias
print_message "Instalando dependencias..."
npm install

# 3. Verificar variables de entorno
if [ ! -f ".env.local" ]; then
    print_warning "Archivo .env.local no encontrado. Creando desde template..."
    cat > .env.local << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-google-maps-api-key

# Node Environment
NODE_ENV=production
EOF
    print_warning "Por favor, edita .env.local con tus credenciales reales antes de continuar."
    print_warning "Ejecuta: nano .env.local"
    exit 1
fi

# 4. Build de producción
print_message "Construyendo aplicación para producción..."
npm run build

# 5. Verificar que ecosystem.config.js existe y usa puerto 4000
if [ ! -f "ecosystem.config.js" ]; then
    print_message "Creando ecosystem.config.js para puerto 4000..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'adiction-boutique',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/ADICTIONBOUTIQUE',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/var/log/pm2/adiction-error.log',
    out_file: '/var/log/pm2/adiction-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
EOF
fi

# 6. Crear directorio de logs si no existe
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# 7. Reiniciar PM2
if command -v pm2 &> /dev/null; then
    print_message "Reiniciando aplicación con PM2..."
    
    # Verificar si la app ya está corriendo
    if pm2 list | grep -q "adiction-boutique"; then
        pm2 restart adiction-boutique
    else
        pm2 start ecosystem.config.js
    fi
    
    pm2 save
else
    print_error "PM2 no está instalado. Instálalo con: sudo npm install -g pm2"
    exit 1
fi

# 8. Verificar configuración de Nginx
if [ ! -f "/etc/nginx/sites-available/adiction-boutique" ]; then
    print_warning "Configuración de Nginx no encontrada. Creando..."
    sudo tee /etc/nginx/sites-available/adiction-boutique > /dev/null << 'EOF'
server {
    listen 80;
    server_name adictionboutique.agsys.es;

    access_log /var/log/nginx/adiction-access.log;
    error_log /var/log/nginx/adiction-error.log;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /_next/static {
        proxy_pass http://localhost:4000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
EOF
    
    # Habilitar sitio
    sudo ln -sf /etc/nginx/sites-available/adiction-boutique /etc/nginx/sites-enabled/
    
    # Verificar configuración
    sudo nginx -t
    
    # Reiniciar Nginx
    sudo systemctl restart nginx
    
    print_warning "Nginx configurado. Ahora configura SSL con:"
    print_warning "sudo certbot --nginx -d adictionboutique.agsys.es"
fi

# 9. Verificar estado
print_message "Verificando estado de la aplicación..."
pm2 status

echo ""
echo "=========================================="
print_message "¡Despliegue completado exitosamente!"
echo "=========================================="
echo ""
print_message "Tu aplicación está corriendo en:"
echo "  - Puerto interno: 4000"
echo "  - URL pública: https://adictionboutique.agsys.es"
echo ""
print_message "Comandos útiles:"
echo "  - Ver logs: pm2 logs adiction-boutique"
echo "  - Ver estado: pm2 status"
echo "  - Reiniciar: pm2 restart adiction-boutique"
echo "  - Ver logs Nginx: sudo tail -f /var/log/nginx/adiction-error.log"
echo ""

# Verificar que el puerto 4000 está en uso
if sudo netstat -tulpn | grep -q ":4000"; then
    print_message "Puerto 4000 está activo ✓"
else
    print_warning "Puerto 4000 no está en uso. Verifica los logs: pm2 logs adiction-boutique"
fi

echo ""
