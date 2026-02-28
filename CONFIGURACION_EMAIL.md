# Configuración de Envío de Correos

## Opción 1: Resend (RECOMENDADO)

### Ventajas:
- ✅ Gratis hasta 100 correos/día
- ✅ Fácil de configurar
- ✅ Funciona con cualquier dominio
- ✅ Mejor para producción

### Pasos:
1. Ve a https://resend.com
2. Crea una cuenta gratis
3. Obtén tu API key en el dashboard
4. Actualiza `.env.local`:

```env
RESEND_API_KEY=re_tu_api_key_aqui
RESEND_FROM_EMAIL=ventas@adictionboutique.com
```

---

## Opción 2: Gmail SMTP

### Ventajas:
- ✅ Usa tu correo de Gmail
- ✅ Gratis
- ✅ No requiere servicios externos

### Pasos:

#### 1. Habilitar "Contraseñas de aplicación" en Gmail:

1. Ve a https://myaccount.google.com/security
2. En el panel izquierdo, selecciona "Seguridad"
3. Activa "Verificación en dos pasos" (si no está activa)
4. Vuelve a "Seguridad" y busca "Contraseñas de aplicación"
5. Selecciona:
   - Aplicación: **Correo**
   - Dispositivo: **Windows (o tu SO)**
6. Google te generará una contraseña de 16 caracteres
7. **Copia esa contraseña** (sin espacios)

#### 2. Actualizar `.env.local`:

```env
GMAIL_USER=tu_email@gmail.com
GMAIL_PASSWORD=tu_contraseña_de_16_caracteres
```

**Ejemplo:**
```env
GMAIL_USER=ventas@adictionboutique.com
GMAIL_PASSWORD=abcd efgh ijkl mnop
```

#### 3. Reinicia el servidor:

```bash
npm run dev
```

---

## Cómo funciona el sistema:

El sistema intenta enviar correos en este orden:

1. **Resend** (si `RESEND_API_KEY` está configurado)
2. **Gmail** (si `GMAIL_USER` y `GMAIL_PASSWORD` están configurados)
3. **Simulación** (si ninguno está configurado - solo en desarrollo)

---

## Prueba de envío:

1. Ve a `http://localhost:3000`
2. Inicia sesión
3. Ve a **POS** (Punto de Venta)
4. Completa una venta
5. En el ticket, haz clic en **Email**
6. Ingresa un correo y haz clic en **Enviar**
7. Verifica que recibas el correo

---

## Solución de problemas:

### "Email enviado exitosamente (simulado)"
- Significa que no hay servicio de email configurado
- Configura Resend o Gmail según las instrucciones arriba

### "Error al enviar email: Invalid login"
- La contraseña de Gmail es incorrecta
- Verifica que sea la contraseña de aplicación (16 caracteres), no tu contraseña normal

### "Error al enviar email: ENOTFOUND"
- Problema de conexión a internet
- Verifica tu conexión

### "Error al enviar email: EAUTH"
- Las credenciales de Gmail son incorrectas
- Regenera la contraseña de aplicación

---

## Recomendación:

Para **desarrollo local**: Usa Gmail (es más fácil)
Para **producción**: Usa Resend (es más confiable)

Puedes tener ambas configuradas y el sistema usará Resend primero, luego Gmail como fallback.
