# 🚨 DEBUG URGENTE - PROBLEMA CON IMÁGENES EN CATÁLOGO

## 📋 PROBLEMA REPORTADO
- **Síntoma:** No se pueden asignar imágenes en el Catálogo Visual
- **Ubicación:** Catálogos > Catálogo Visual > Modal de producto > "Elegir archivo..."
- **Estado:** El botón "Elegir archivo..." no responde o no sube las imágenes

## 🔍 POSIBLES CAUSAS

### 1. **Problema de Permisos RLS en Supabase**
- Las políticas de Row Level Security pueden estar bloqueando las inserciones
- **Solución:** Ejecutar `FIX_IMAGENES_CATALOGO_URGENTE.sql`

### 2. **Problema con el Storage Bucket**
- El bucket `product-images` puede no tener las políticas correctas
- **Verificar:** Políticas de storage en Supabase Dashboard

### 3. **Error en la API de Upload**
- La API `/api/upload/product-image` puede estar fallando
- **Verificar:** Logs del servidor y respuestas de la API

### 4. **Problema con el Service Role Key**
- La clave de servicio puede estar mal configurada
- **Verificar:** Variable `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`

## 🛠️ PASOS DE CORRECCIÓN

### **PASO 1: Ejecutar Corrección de Base de Datos**
```sql
-- Ejecutar en Supabase SQL Editor:
-- Contenido del archivo: supabase/FIX_IMAGENES_CATALOGO_URGENTE.sql
```

### **PASO 2: Verificar Storage Policies**
1. Ir a Supabase Dashboard > Storage > product-images
2. Verificar que existan estas políticas:
   - **SELECT:** `(bucket_id = 'product-images')`
   - **INSERT:** `(bucket_id = 'product-images') AND (auth.role() = 'authenticated')`
   - **UPDATE:** `(bucket_id = 'product-images') AND (auth.role() = 'authenticated')`
   - **DELETE:** `(bucket_id = 'product-images') AND (auth.role() = 'authenticated')`

### **PASO 3: Verificar Variables de Entorno**
Asegurarse de que en `.env.local` estén correctas:
```env
NEXT_PUBLIC_SUPABASE_URL=https://mwdqdrqlzlffmfqqcnmp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **PASO 4: Probar la API Directamente**
```bash
# Probar la API de upload con curl:
curl -X POST https://adicionboutique.agsys.es/api/upload/product-image \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test-image.jpg" \
  -F "base_code=TEST-001" \
  -F "is_primary=true"
```

### **PASO 5: Verificar Logs del Servidor**
```bash
# En la VPS:
ssh -i tiendakey.pem ubuntu@18.224.29.109
pm2 logs adiction-boutique --lines 50
```

## 🧪 CÓMO PROBAR LA CORRECCIÓN

1. **Ir al Catálogo Visual:**
   - https://adicionboutique.agsys.es/catalogs/visual

2. **Seleccionar un producto:**
   - Hacer clic en cualquier producto

3. **Intentar subir imagen:**
   - Hacer clic en "Elegir archivo..."
   - Seleccionar una imagen JPG/PNG
   - Verificar que se suba correctamente

4. **Marcar como principal:**
   - Activar checkbox "Principal"
   - Hacer clic en "OK"
   - Verificar que aparezca la imagen en el catálogo

## 🚨 SI EL PROBLEMA PERSISTE

### **Opción A: Rollback Temporal**
```bash
# Revertir a la versión anterior
git revert HEAD
git push origin master
# Deploy en VPS
```

### **Opción B: Verificación Manual**
1. Abrir DevTools (F12) en el navegador
2. Ir a Network tab
3. Intentar subir imagen
4. Verificar si hay errores 400/500 en las requests
5. Revisar Console tab para errores JavaScript

### **Opción C: Verificar Bucket Storage**
1. Ir a Supabase Dashboard
2. Storage > product-images
3. Intentar subir archivo manualmente
4. Verificar que el bucket esté configurado como público

## 📞 CONTACTO DE EMERGENCIA
Si el problema es crítico y bloquea operaciones:
1. Ejecutar el script de corrección SQL inmediatamente
2. Reiniciar la aplicación: `pm2 restart adiction-boutique`
3. Verificar que las otras funcionalidades sigan funcionando