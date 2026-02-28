# 🚀 Despliegue en Subdominio - adictionboutique.agsys.es

## 📋 Configuración

- **Subdominio:** adictionboutique.agsys.es
- **Puerto:** 4000 (puerto 3000 usado por landing page)
- **IP VPS:** 13.59.209.180
- **DNS:** Ya configurado ✅

---

## 🔐 Paso 1: Conectar al VPS

```bash
# Dar permisos a la llave
chmod 400 aws-key.pem

# Conectar
ssh -i aws-key.pem ubuntu@13.59.209.180
```

---

## 📦 Paso 2: Clonar y Configurar el Proyecto

```bash
# Ir al directorio de aplicaciones
cd /var/www

# Clonar repositorio
sudo git clone https://github.com/Gilmore369/ADICTIONBOUTIQUE.git

# Cambiar permisos
sudo chown -R $USER:$USER ADICTIONBOUTIQUE

# Entrar al directorio
cd ADICTIONBOUTIQUE

# Instalar dependencias
npm install
```

---

## 🔑 Paso 3: Configurar Variables de Entorno

```bash
# Crear archivo .env.local
nano .env.local
```

Pega este contenido (reemplaza con tus valores reales):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-api-key-de-google-maps

# Node Environment
NODE_ENV=production

# Puerto (importante: 4000 para no conflicto con landing)
PORT=4000
```

Guardar: `Ctrl+O`, Enter, `Ctrl+X`

---

## 🏗️ Paso 4: Build de Producción

```bash
# Construir la aplicación
npm run build

# Verificar que el build fue exitoso
ls -la .next
```

---

## 🔄 Paso 5: Configurar PM2 (Puerto 4000)

```bash
# El archivo ecosystem.config.js ya está configurado para puerto 4000
# Verificar contenido
cat ecosystem.config.js

# Crear directorio de logs si no existe
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Iniciar aplicación con PM2
pm2 start ecosystem.config.js

# Configurar PM2 para inicio automático
pm2 startup
# Ejecutar el comando que PM2 te muestre (algo como: sudo env PATH=...)

pm2 save

# Verificar estado
pm2 status
pm2 logs adiction-boutique
```

---

## 🌐 Paso 6: Configurar Nginx para Subdominio

```bash
# Copiar configuración de Nginx
sudo cp nginx-adictionboutique.conf /etc/nginx/sites-available/adiction-boutique

# O crear manualmente
sudo nano /etc/nginx/sites-available/adiction-boutique
```

Pega este contenido:

```nginx
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
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/adiction-boutique /etc/nginx/sites-enabled/

# Verificar configuración de Nginx
sudo nginx -t

# Si todo está OK, reiniciar Nginx
sudo systemctl restart nginx
```

---

## 🔒 Paso 7: Configurar SSL con Let's Encrypt

```bash
# Obtener certificado SSL para el subdominio
sudo certbot --nginx -d adictionboutique.agsys.es

# Seguir las instrucciones:
# 1. Ingresar email (si es la primera vez)
# 2. Aceptar términos (Y)
# 3. Elegir opción 2 (redirect HTTP a HTTPS)

# Verificar renovación automática
sudo certbot renew --dry-run
```

---

## ✅ Paso 8: Verificar Despliegue

```bash
# Verificar que Next.js está corriendo en puerto 4000
curl http://localhost:4000

# Ver logs de PM2
pm2 logs adiction-boutique --lines 50

# Ver estado de Nginx
sudo systemctl status nginx

# Ver logs de Nginx
sudo tail -f /var/log/nginx/adiction-access.log
```

Abre tu navegador y ve a:
- **http://adictionboutique.agsys.es** (se redirigirá a HTTPS)
- **https://adictionboutique.agsys.es** ✅

---

## 🔄 Actualizar la Aplicación

Cuando necesites actualizar el código:

```bash
# Conectar al VPS
ssh -i aws-key.pem ubuntu@13.59.209.180

# Ir al directorio
cd /var/www/ADICTIONBOUTIQUE

# Pull cambios
git pull origin main

# Instalar nuevas dependencias (si hay)
npm install

# Rebuild
npm run build

# Reiniciar PM2
pm2 restart adiction-boutique

# Ver logs
pm2 logs adiction-boutique
```

---

## 📝 Comandos Útiles

```bash
# Ver logs en tiempo real
pm2 logs adiction-boutique

# Ver estado de todas las apps PM2
pm2 status

# Reiniciar aplicación
pm2 restart adiction-boutique

# Ver uso de recursos
pm2 monit

# Ver logs de Nginx
sudo tail -f /var/log/nginx/adiction-access.log
sudo tail -f /var/log/nginx/adiction-error.log

# Reiniciar Nginx
sudo systemctl restart nginx

# Verificar configuración de Nginx
sudo nginx -t

# Ver certificados SSL
sudo certbot certificates
```

---

## 🐛 Solución de Problemas

### Error: Puerto 4000 ya en uso

```bash
# Ver qué está usando el puerto 4000
sudo lsof -i :4000

# Matar proceso si es necesario
sudo kill -9 <PID>

# Reiniciar PM2
pm2 restart adiction-boutique
```

### Error 502 Bad Gateway

```bash
# Verificar que la aplicación está corriendo
pm2 status
pm2 logs adiction-boutique

# Verificar que está escuchando en puerto 4000
curl http://localhost:4000

# Reiniciar aplicación
pm2 restart adiction-boutique

# Reiniciar Nginx
sudo systemctl restart nginx
```

### La aplicación no carga

```bash
# Ver logs detallados
pm2 logs adiction-boutique --lines 100

# Verificar variables de entorno
cat .env.local

# Verificar que el build fue exitoso
ls -la .next

# Verificar permisos
ls -la /var/www/ADICTIONBOUTIQUE
```

### Error de SSL

```bash
# Verificar certificados
sudo certbot certificates

# Renovar certificado manualmente
sudo certbot renew

# Ver logs de Certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## 📊 Estructura de Puertos

En tu VPS ahora tienes:

- **Puerto 3000:** Landing page (agsys.es)
- **Puerto 4000:** ADICTION BOUTIQUE (adictionboutique.agsys.es)

Nginx hace el proxy inverso según el dominio:
- `agsys.es` → `localhost:3000`
- `adictionboutique.agsys.es` → `localhost:4000`

---

## 🔐 Security Checklist

- [ ] Puerto 4000 solo accesible desde localhost (no expuesto directamente)
- [ ] Nginx configurado como proxy inverso
- [ ] SSL/HTTPS configurado con Let's Encrypt
- [ ] Firewall configurado (solo puertos 22, 80, 443 abiertos)
- [ ] PM2 configurado para reinicio automático
- [ ] Variables de entorno seguras en .env.local
- [ ] Logs configurados y rotando

---

## 📞 Checklist de Despliegue

- [ ] Conectado al VPS por SSH
- [ ] Repositorio clonado en `/var/www/ADICTIONBOUTIQUE`
- [ ] Variables de entorno configuradas en `.env.local`
- [ ] Build de producción exitoso
- [ ] PM2 corriendo en puerto 4000
- [ ] Nginx configurado para subdominio
- [ ] SSL configurado con Certbot
- [ ] Aplicación accesible en https://adictionboutique.agsys.es
- [ ] No hay conflicto con puerto 3000 (landing page)

---

## 🎯 URLs Finales

- **Landing Page:** https://agsys.es (puerto 3000)
- **ADICTION BOUTIQUE:** https://adictionboutique.agsys.es (puerto 4000)

---

**¡Tu aplicación está lista en el subdominio!** 🎉
