# 🚀 DEPLOY FINAL - Comandos Directos

## ✅ Ya Completado
- [x] Código subido al VPS
- [x] Migraciones ejecutadas en Supabase
- [x] Campo de código de barras implementado

## 🔧 Pasos Finales

### 1. Conectar al VPS
```bash
ssh -i /tmp/k.pem ubuntu@18.224.29.109
```

### 2. Verificar Estado Actual
```bash
cd /var/www/ADICTIONBOUTIQUE
git status
ls -la
pm2 status
```

### 3. Build y Deploy
```bash
cd /var/www/ADICTIONBOUTIQUE
npm run build
pm2 restart adiction-boutique --update-env
pm2 logs adiction-boutique --lines 50
```

### 4. Verificar URLs
- https://adictionboutique.agsys.es/
- https://asistenciasboutique.agsys.es/

---

## 🎯 Funcionalidades a Probar

### ✅ Código de Barras
1. Ir a **Inventario → Productos → Nuevo Producto**
2. Llenar campo **"Código de Barras"**: `TEST123456789`
3. Completar campos obligatorios
4. Guardar producto
5. Verificar que aparece en la lista con el código

### ✅ Prevención de Duplicados
1. Intentar crear otro producto con el mismo código: `TEST123456789`
2. Debe mostrar error: "El código de barras ya existe"

### ✅ Sistema de Pagos (Idempotency)
1. Ir a **Cobranzas**
2. Registrar un pago
3. Verificar que no se duplican pagos por doble clic

### ✅ Sistema de Caja
1. Ir a **Caja**
2. Abrir turno
3. Realizar venta de prueba
4. Cerrar turno
5. Verificar que no hay errores

---

## 🔍 Verificación de Logs

### Si hay errores:
```bash
# Ver logs detallados
pm2 logs adiction-boutique --lines 100

# Reiniciar si es necesario
pm2 restart adiction-boutique

# Ver estado de procesos
pm2 list

# Ver uso de recursos
pm2 monit
```

### Si nginx no funciona:
```bash
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t  # Verificar configuración
```

---

## 📊 Checklist Final

### Funcionalidades Críticas:
- [ ] Login funciona
- [ ] Dashboard carga
- [ ] POS accesible
- [ ] Inventario funciona
- [ ] Crear producto con código de barras
- [ ] Búsqueda de productos
- [ ] Realizar venta
- [ ] Sistema de caja
- [ ] Reportes básicos

### URLs Funcionando:
- [ ] https://adictionboutique.agsys.es/
- [ ] https://asistenciasboutique.agsys.es/

### Sin Errores en Logs:
- [ ] No hay errores críticos en PM2 logs
- [ ] No hay errores 500 en la aplicación
- [ ] Base de datos conecta correctamente

---

## 🎉 Resultado Esperado

Después del deploy deberías tener:
- ✅ Aplicación funcionando en ambas URLs
- ✅ Campo de código de barras operativo
- ✅ Sistema de pagos sin duplicados
- ✅ Funciones de stock mejoradas
- ✅ POS sin race conditions
- ✅ Sistema más estable y robusto

---

## 🆘 Si Algo Falla

### Error de Build:
```bash
# Limpiar cache y reinstalar
rm -rf node_modules .next
npm install
npm run build
```

### Error de PM2:
```bash
# Eliminar y recrear proceso
pm2 delete adiction-boutique
pm2 start npm --name "adiction-boutique" -- start
pm2 save
```

### Error de Permisos:
```bash
# Verificar propietario
sudo chown -R ubuntu:ubuntu /var/www/ADICTIONBOUTIQUE
```

---

**¡Listo para el deploy final!** 🚀

Ejecuta los comandos paso a paso y verifica que todo funcione correctamente.