-- Activar la línea de Perfumes y crear categorías y tallas
-- Ejecutar en Supabase SQL Editor

-- 1. Activar la línea de Perfumes
UPDATE lines 
SET active = true 
WHERE name = 'Perfumes';

-- 2. Obtener el ID de la línea de Perfumes
DO $$
DECLARE
    perfumes_line_id UUID;
    perfumes_category_id UUID;
BEGIN
    -- Obtener ID de la línea Perfumes
    SELECT id INTO perfumes_line_id 
    FROM lines 
    WHERE name = 'Perfumes';

    -- Crear categorías para Perfumes
    -- Categoría: Fragancias Hombre
    INSERT INTO categories (name, line_id, description, active)
    VALUES ('Fragancias Hombre', perfumes_line_id, 'Perfumes masculinos', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO perfumes_category_id;

    -- Crear tallas para Fragancias Hombre
    IF perfumes_category_id IS NOT NULL THEN
        INSERT INTO sizes (name, category_id, active)
        VALUES 
            ('30ml', perfumes_category_id, true),
            ('50ml', perfumes_category_id, true),
            ('100ml', perfumes_category_id, true),
            ('150ml', perfumes_category_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Categoría: Fragancias Mujer
    INSERT INTO categories (name, line_id, description, active)
    VALUES ('Fragancias Mujer', perfumes_line_id, 'Perfumes femeninos', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO perfumes_category_id;

    -- Crear tallas para Fragancias Mujer
    IF perfumes_category_id IS NOT NULL THEN
        INSERT INTO sizes (name, category_id, active)
        VALUES 
            ('30ml', perfumes_category_id, true),
            ('50ml', perfumes_category_id, true),
            ('100ml', perfumes_category_id, true),
            ('150ml', perfumes_category_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Categoría: Fragancias Unisex
    INSERT INTO categories (name, line_id, description, active)
    VALUES ('Fragancias Unisex', perfumes_line_id, 'Perfumes unisex', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO perfumes_category_id;

    -- Crear tallas para Fragancias Unisex
    IF perfumes_category_id IS NOT NULL THEN
        INSERT INTO sizes (name, category_id, active)
        VALUES 
            ('30ml', perfumes_category_id, true),
            ('50ml', perfumes_category_id, true),
            ('100ml', perfumes_category_id, true),
            ('150ml', perfumes_category_id, true),
            ('200ml', perfumes_category_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

END $$;

-- Verificar los cambios
SELECT 
    l.name as linea,
    l.active as linea_activa,
    c.name as categoria,
    c.active as categoria_activa,
    COUNT(s.id) as cantidad_tallas
FROM lines l
LEFT JOIN categories c ON c.line_id = l.id
LEFT JOIN sizes s ON s.category_id = c.id
WHERE l.name = 'Perfumes'
GROUP BY l.name, l.active, c.name, c.active
ORDER BY c.name;
