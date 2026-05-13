# Guía: Migrar el sistema a una nueva VPS

Esta guía sirve para cuando expire la VPS actual (`18.224.29.109`) y necesites
levantar el sistema en otro proveedor desde cero, usando el código de GitHub.

## ✅ Lo que NO se pierde (vive en Supabase, no en la VPS)

- Base de datos completa (productos, ventas, clientes, deudas, pagos, etc.)
- Usuarios y sus permisos (auth.users + public.users)
- Imágenes de productos y clientes (Supabase Storage)
- Migraciones SQL (Supabase Dashboard)

La VPS es solo el servidor de Next.js — ES DESCARTABLE. Cuando la cambies,
los datos están seguros en Supabase.

## ✅ Lo que necesitas tener a mano

| Recurso | Dónde está |
|---|---|
| Código fuente | https://github.com/Gilmore369/ADICTIONBOUTIQUE (rama `master`) |
| Variables de entorno | `.env.local` (claves Supabase + Google Maps API) |
| Service role key | Supabase Dashboard → Settings → API |
| Anon key | Supabase Dashboard → Settings → API |
| Google Maps API key | Google Cloud Console |
| Llave SSH | Generar nueva al crear la VPS |
| Dominio | Si tienes `adictionboutique.agsys.es` apuntando con A record |

## 🚀 Pasos para una nueva VPS Ubuntu 22.04+

### 1. Provisionar VPS

Cualquier proveedor sirve: AWS EC2 (free tier), DigitalOcean, Hetzner, Vultr,
Oracle Cloud Free Tier (Always Free), etc.

**Recomendación**: mínimo 1 vCPU, 1 GB RAM, 10 GB disco.

### 2. Conectarse y preparar el sistema

```bash
ssh -i tu-llave.pem ubuntu@TU-NUEVA-IP

sudo apt update && sudo apt upgrade -y
sudo apt install -y apache2 git curl

# Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 global
sudo npm install -g pm2

# Verificar versiones
node -v   # debe ser >= 20
npm -v
pm2 -v
```

### 3. Clonar el código

```bash
sudo mkdir -p /var/www/ADICTIONBOUTIQUE
sudo chown -R ubuntu:ubuntu /var/www/ADICTIONBOUTIQUE
cd /var/www
git clone https://github.com/Gilmore369/ADICTIONBOUTIQUE.git ADICTIONBOUTIQUE
cd ADICTIONBOUTIQUE
git checkout master
```

### 4. Configurar `.env.local`

```bash
nano .env.local
```

Pegar (reemplazar con valores reales del Dashboard de Supabase):

```env
NEXT_PUBLIC_SUPABASE_URL=https://mwdqdrqlzlffmfqqcnmp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # service_role secret
GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

### 5. Instalar dependencias y compilar

```bash
npm install --no-audit --no-fund
sudo npm run build

# IMPORTANTE: post-build, dar ownership a ubuntu
sudo chown -R ubuntu:ubuntu .next/
```

### 6. Levantar con PM2

```bash
pm2 start "npm run start" --name adiction-boutique
pm2 save
pm2 startup   # ejecutar el comando que imprime para iniciar al boot
```

Verificar: `pm2 list` debe mostrar `adiction-boutique` en estado `online`.

### 7. Configurar Apache como reverse proxy

```bash
sudo a2enmod proxy proxy_http rewrite ssl headers
sudo nano /etc/apache2/sites-available/adiction-boutique.conf
```

Pegar:

```apache
<VirtualHost *:80>
    ServerName adictionboutique.agsys.es
    ServerAdmin gianpepex@gmail.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    ErrorLog ${APACHE_LOG_DIR}/adiction-error.log
    CustomLog ${APACHE_LOG_DIR}/adiction-access.log combined
</VirtualHost>
```

```bash
sudo a2ensite adiction-boutique
sudo a2dissite 000-default
sudo systemctl reload apache2
```

### 8. Apuntar el dominio a la nueva IP

En tu proveedor de dominios (donde administras `agsys.es`), cambiar el
A record de `adictionboutique` a la nueva IP de la VPS.

Espera 5-15 minutos para propagación DNS.

### 9. SSL con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d adictionboutique.agsys.es \
  --email gianpepex@gmail.com --agree-tos --redirect --non-interactive
```

### 10. Validar

Abre `https://adictionboutique.agsys.es` — debe cargar el login.
Inicia sesión con `gianpepex@gmail.com` y verifica que veas datos.

## 🔁 Workflow de actualización en la nueva VPS

```bash
ssh -i tu-llave.pem ubuntu@TU-NUEVA-IP
cd /var/www/ADICTIONBOUTIQUE
git pull origin master
sudo npm install --no-audit --no-fund   # solo si cambió package.json
sudo npm run build
sudo chown -R ubuntu:ubuntu .next/      # CRÍTICO: post-build
pm2 restart adiction-boutique --update-env
```

## 🚨 Errores comunes y soluciones

### `MODULE_NOT_FOUND: middleware-manifest.json`
**Causa**: build con `sudo` dejó `.next/` owned por root, PM2 corre como ubuntu.
**Fix**: `sudo chown -R ubuntu:ubuntu .next/` y reiniciar PM2.

### Build falla con `EACCES`
**Causa**: permisos del proyecto.
**Fix**: `sudo chown -R ubuntu:ubuntu /var/www/ADICTIONBOUTIQUE` antes del build.

### `Bad Gateway` 502
**Causa**: PM2 no está corriendo o crasheó.
**Fix**: `pm2 list` para verificar; `pm2 logs adiction-boutique` para ver error;
`pm2 restart adiction-boutique --update-env`.

### Imágenes / fotos no aparecen
**Causa**: el navegador cargó la versión vieja en caché.
**Fix**: refrescar con Ctrl+Shift+R. Las imágenes viven en Supabase Storage,
no en la VPS, así que siempre están disponibles tras el cambio de servidor.

## 🆓 Opciones de VPS gratuitas / muy baratas

| Proveedor | Plan free | Notas |
|---|---|---|
| **Oracle Cloud** | Always Free (4 CPU ARM + 24 GB RAM) | El mejor "free" del mercado, no caduca |
| **AWS EC2** | t2.micro/t3.micro 12 meses | El actual; expira |
| **Google Cloud** | e2-micro 1 vCPU 1 GB | Always Free región us-west1/c1/east1 |
| **Hetzner** | CX11 ~€4/mes | Excelente relación precio/rendimiento |
| **DigitalOcean** | $4/mes droplet | Setup rápido, panel amigable |

**Recomendación**: Oracle Cloud Free Tier (ARM Ampere) o Hetzner por €4/mes.

## 📦 Checklist final

- [ ] VPS creada con Ubuntu 22.04+
- [ ] Node 20+ instalado
- [ ] PM2 instalado y configurado para boot
- [ ] Apache instalado con módulos proxy
- [ ] Repo clonado en `/var/www/ADICTIONBOUTIQUE`
- [ ] `.env.local` con las 5 variables
- [ ] `npm install` + `npm run build` exitoso
- [ ] `chown -R ubuntu:ubuntu .next/` post-build
- [ ] PM2 corriendo en estado `online`
- [ ] Apache vhost configurado y habilitado
- [ ] DNS apuntando a nueva IP
- [ ] Let's Encrypt SSL activo
- [ ] Login funciona con `gianpepex@gmail.com`
- [ ] Productos, clientes y ventas visibles
