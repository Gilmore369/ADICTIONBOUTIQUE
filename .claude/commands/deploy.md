# /deploy — Desplegar ERP Adiction Boutique a VPS

Despliega el código actual a producción en el VPS de AWS EC2.

## Pasos

1. **Verificar que no hay cambios sin commitear** — ejecuta `git status` y muestra los archivos pendientes. Si hay cambios sin stage, hazlos todos con un mensaje descriptivo.

2. **Push a GitHub** — ejecuta `git push origin master` y confirma que fue exitoso.

3. **Conectar al VPS vía SSH** y ejecutar en secuencia:
   ```bash
   ssh -i "$HOME/tiendakey.pem" -o StrictHostKeyChecking=no ubuntu@18.224.29.109
   ```
   - `cd /var/www/ADICTIONBOUTIQUE`
   - `git pull origin master`
   - `npm run build` (esperar que termine — puede tardar 2-3 minutos)
   - `pm2 restart adiction-boutique --update-env`
   - `pm2 status` para confirmar que está `online`

4. **Confirmar deploy exitoso** — mostrar el último commit en VPS con `git log --oneline -1`.

## Notas importantes
- La PEM key está en `~/tiendakey.pem` (copiada desde `C:/Users/franc/Downloads/tiendakey.pem`)
- Si la PEM no existe en `~`, copiarla primero: `cp "C:/Users/franc/Downloads/tiendakey.pem" ~/tiendakey.pem && chmod 400 ~/tiendakey.pem`
- IP del VPS: `18.224.29.109` (puede cambiar si EC2 se reinicia — verificar si falla)
- Puerto 3000, Apache2 hace reverse proxy
- Branch en producción: `master`
- NO usar `sudo` con `pm2` — corre como usuario `ubuntu`
