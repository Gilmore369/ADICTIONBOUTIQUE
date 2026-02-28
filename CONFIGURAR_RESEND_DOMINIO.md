# 📧 Configurar Dominio en Resend

## Problema Actual

Resend requiere que verifiques un dominio para enviar correos desde un email personalizado. Por ahora, el sistema usa `onboarding@resend.dev` (email de prueba de Resend).

## ✅ Solución Temporal (Funciona Ahora)

El sistema está configurado para usar `onboarding@resend.dev` que es un email de prueba de Resend que funciona sin verificación de dominio.

**Los correos se enviarán desde:** `onboarding@resend.dev`

## 🔧 Solución Permanente (Opcional)

Si quieres usar tu propio dominio (`ventas@adictionboutique.com`), sigue estos pasos:

### Paso 1: Ir a Resend
1. Ve a https://resend.com/domains
2. Inicia sesión con tu cuenta

### Paso 2: Agregar Dominio
1. Haz clic en "Add Domain"
2. Ingresa tu dominio: `adictionboutique.com`
3. Haz clic en "Add"

### Paso 3: Verificar Dominio
Resend te dará registros DNS para agregar a tu proveedor de dominio:

```
Tipo: CNAME
Nombre: default._domainkey.adictionboutique.com
Valor: default.resend.dev
```

1. Ve a tu proveedor de dominio (GoDaddy, Namecheap, etc.)
2. Agrega el registro CNAME
3. Espera 24-48 horas para que se propague

### Paso 4: Verificar en Resend
1. Vuelve a Resend
2. Haz clic en "Verify" en tu dominio
3. Espera a que se verifique

### Paso 5: Actualizar `.env.local`
```env
RESEND_FROM_EMAIL=ventas@adictionboutique.com
```

## 📊 Estado Actual

- ✅ **Email de prueba:** `onboarding@resend.dev` (funciona sin configuración)
- ⏳ **Email personalizado:** `ventas@adictionboutique.com` (requiere verificación de dominio)

## 🧪 Cómo Probar

1. Ve a `http://localhost:3000/pos`
2. Completa una venta
3. En el ticket, haz clic en "Email"
4. Ingresa un correo
5. Haz clic en "Enviar"
6. Verifica que recibas el correo

## 📝 Notas

- Los correos se enviarán desde `onboarding@resend.dev` hasta que verifiques tu dominio
- El contenido del correo es el mismo
- El proceso de verificación toma 24-48 horas

## 🆘 Si no recibas correos

1. Revisa la carpeta de spam
2. Verifica que el email sea válido
3. Revisa los logs del servidor para errores
4. Intenta con otro email

---

**¡Listo!** Los correos funcionan con el email de prueba de Resend. 🎉
