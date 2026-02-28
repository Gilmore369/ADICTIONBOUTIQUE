# 🚀 INICIO RÁPIDO

## Acceso a la aplicación

**URL:** `http://localhost:3000`

---

## 📋 Checklist de funcionalidades

### ✅ Ingreso Masivo de Productos
```
Inventario > Ingreso Masivo
```
- Selecciona proveedor
- Crea productos con tallas
- Especifica cantidades
- Guarda

### ✅ Ver Stock
```
Catálogos > Productos
```
- Verifica que aparezca el stock

### ✅ Ver Movimientos
```
Inventario > Movimientos
```
- Verifica que aparezcan como "Entrada" (verde)

### ✅ Punto de Venta
```
POS
```
- Cambia tienda (Mujeres/Hombres)
- Busca productos
- Completa venta
- Envía ticket por correo

### ✅ Envío de Correos
```
En el ticket de venta > Email
```
- Ingresa correo
- Haz clic en Enviar
- Verifica que llegue el correo

---

## 🔑 Credenciales

### Supabase
- **URL:** https://mwdqdrqlzlffmfqqcnmp.supabase.co
- **Anon Key:** Configurada en `.env.local`

### Resend
- **API Key:** re_NkmgEmc6_4ckZpikxWBJDRFBFFPUFXovM
- **Remitente:** ventas@adictionboutique.com

### Google Maps
- **API Key:** AIzaSyC1pYCWUbYMoRTn2pGlyaN5YICuPFOKz5U

---

## 🛠️ Comandos útiles

```bash
# Iniciar servidor
npm run dev

# Construir para producción
npm run build

# Ejecutar en producción
npm start

# Linter
npm run lint
```

---

## 📊 Datos de prueba

### Proveedores
- Distribuidora Lima SAC
- Importaciones del Sur
- Textiles Peruanos

### Marcas
- Zara
- H&M
- Forever 21
- Mango
- Pull&Bear
- ARMY EE.UU

### Almacenes
- TIENDA_MUJERES
- TIENDA_HOMBRES

---

## 🎯 Flujo típico de uso

1. **Crear productos:**
   - Inventario > Ingreso Masivo
   - Selecciona proveedor
   - Crea productos con tallas
   - Guarda

2. **Vender:**
   - POS
   - Busca producto
   - Agrega al carrito
   - Completa venta

3. **Enviar ticket:**
   - En el modal del ticket
   - Haz clic en Email
   - Ingresa correo
   - Envía

4. **Consultar:**
   - Catálogos > Productos (ver stock)
   - Inventario > Movimientos (ver historial)
   - Clientes (ver deudas)

---

## ⚠️ Notas importantes

- El servidor se reinicia automáticamente si cambias `.env.local`
- Los correos se envían desde `ventas@adictionboutique.com`
- El stock se suma de todos los almacenes
- Los movimientos se registran automáticamente

---

## 🆘 Si algo no funciona

1. Verifica que el servidor esté corriendo: `npm run dev`
2. Limpia el caché: `rm -rf .next`
3. Reinicia el servidor
4. Revisa los logs en la consola

---

## 📞 Contacto

Para más información, revisa:
- `RESUMEN_FINAL.md` - Resumen completo
- `CONFIGURACION_EMAIL.md` - Configuración de correos
- `PRUEBA_EMAIL.md` - Cómo probar correos

---

**¡Listo para usar!** 🎉
