-- Script para agregar fotos a los clientes con atraso
-- Estos clientes actualmente tienen client_photo_url = NULL

-- Opción 1: Usar fotos de Luisa como ejemplo (si existen en el storage)
-- Nota: Debes reemplazar estas URLs con las fotos reales de cada cliente

-- Rosa Elena Mamani (cc000003-0000-0000-0000-000000000000)
UPDATE clients 
SET client_photo_url = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/photo/rosa-elena-mamani.jpg',
    dni_photo_url = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/dni/rosa-elena-mamani-dni.jpg'
WHERE id = 'cc000003-0000-0000-0000-000000000000';

-- Pedro Huamaní Ccori (cc000006-0000-0000-0000-000000000000)
UPDATE clients 
SET client_photo_url = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/photo/pedro-huamani-ccori.jpg',
    dni_photo_url = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/dni/pedro-huamani-ccori-dni.jpg'
WHERE id = 'cc000006-0000-0000-0000-000000000000';

-- Verificar que se actualizaron correctamente
SELECT 
  id,
  name,
  dni,
  client_photo_url,
  dni_photo_url,
  CASE 
    WHEN client_photo_url IS NOT NULL THEN '✅ Tiene foto'
    ELSE '❌ Sin foto'
  END as estado_foto
FROM clients
WHERE id IN ('cc000003-0000-0000-0000-000000000000', 'cc000006-0000-0000-0000-000000000000');

-- Opción 2: Si no tienes fotos reales, puedes usar placeholders temporales
-- Esto permitirá que el sistema funcione mientras subes las fotos reales

-- NOTA: Antes de ejecutar este script, debes:
-- 1. Subir las fotos reales a Supabase Storage en la carpeta 'product-images/clients/photo/'
-- 2. Subir las fotos de DNI a 'product-images/clients/dni/'
-- 3. Actualizar las URLs en este script con las URLs reales de Supabase Storage
-- 4. Ejecutar el script

-- Para subir fotos a Supabase Storage:
-- 1. Ve a tu proyecto en Supabase Dashboard
-- 2. Storage > product-images > clients > photo
-- 3. Sube las fotos con nombres descriptivos (ej: rosa-elena-mamani.jpg)
-- 4. Copia la URL pública de cada foto
-- 5. Actualiza este script con las URLs correctas
