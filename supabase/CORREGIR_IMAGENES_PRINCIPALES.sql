-- ============================================================================
-- CORRECCIÓN INMEDIATA - MARCAR IMÁGENES COMO PRINCIPALES
-- ============================================================================
-- Fecha: 2026-05-13
-- Descripción: Corregir imágenes existentes que no están marcadas como principales

-- 1. Para cada base_code que tiene imágenes pero ninguna principal,
--    marcar la primera imagen (más antigua) como principal
WITH models_without_primary AS (
    SELECT DISTINCT base_code
    FROM product_images pi1
    WHERE NOT EXISTS (
        SELECT 1 
        FROM product_images pi2 
        WHERE pi2.base_code = pi1.base_code 
        AND pi2.is_primary = true
    )
),
first_image_per_model AS (
    SELECT DISTINCT ON (base_code) 
        id, base_code
    FROM product_images 
    WHERE base_code IN (SELECT base_code FROM models_without_primary)
    ORDER BY base_code, created_at ASC
)
UPDATE product_images 
SET is_primary = true 
WHERE id IN (SELECT id FROM first_image_per_model);

-- 2. Verificar el resultado
SELECT 
    'DESPUÉS DE LA CORRECCIÓN' as estado,
    (SELECT COUNT(*) FROM product_images) as total_imagenes,
    (SELECT COUNT(DISTINCT base_code) FROM product_images) as modelos_con_imagenes,
    (SELECT COUNT(*) FROM product_images WHERE is_primary = true) as imagenes_principales,
    (SELECT COUNT(*) FROM product_images WHERE color IS NOT NULL) as imagenes_con_color;

-- 3. Mostrar qué imágenes se marcaron como principales
SELECT 
    base_code,
    id,
    storage_path,
    is_primary,
    created_at
FROM product_images 
WHERE is_primary = true
ORDER BY base_code;