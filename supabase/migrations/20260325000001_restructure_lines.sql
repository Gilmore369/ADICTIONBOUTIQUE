-- ============================================================
-- Migración: Reestructurar líneas de productos
--
-- ANTES: 6 líneas (Accesorios, Hombres, Mochilas, Mujeres, Niños, Perfumes)
-- DESPUÉS: 3 líneas (Hombres, Mujeres, Niños)
--   Accesorios, Mochilas, Perfumes pasan a ser CATEGORÍAS dentro de Mujeres
--
-- Pasos:
--   1. Identificar las 3 líneas principales a mantener
--   2. Mover productos de Accesorios/Mochilas/Perfumes a Mujeres
--   3. Crear categorías para esas ex-líneas si no existen
--   4. Actualizar categorías de productos afectados
--   5. Actualizar line_stores para las 3 líneas
--   6. Eliminar líneas sobrantes (con cascade en line_stores y categories)
-- ============================================================

BEGIN;

-- ─── 0. Verificar IDs de las líneas actuales ─────────────────────────────────
-- Ejecuta primero este SELECT para ver los IDs:
-- SELECT id, name FROM lines ORDER BY name;

-- ─── 1. Guardar IDs en variables temporales ──────────────────────────────────
DO $$
DECLARE
  v_line_mujeres   UUID;
  v_line_hombres   UUID;
  v_line_ninos     UUID;
  v_line_accesorios UUID;
  v_line_mochilas  UUID;
  v_line_perfumes  UUID;
  v_store_mujeres  UUID;
  v_store_hombres  UUID;
  v_cat_accesorios UUID;
  v_cat_mochilas   UUID;
  v_cat_perfumes   UUID;
BEGIN

  -- Obtener IDs de líneas
  SELECT id INTO v_line_mujeres   FROM lines WHERE LOWER(name) = 'mujeres'    LIMIT 1;
  SELECT id INTO v_line_hombres   FROM lines WHERE LOWER(name) = 'hombres'    LIMIT 1;
  SELECT id INTO v_line_ninos     FROM lines WHERE LOWER(name) IN ('niños','ninos') LIMIT 1;
  SELECT id INTO v_line_accesorios FROM lines WHERE LOWER(name) LIKE '%accesorio%' LIMIT 1;
  SELECT id INTO v_line_mochilas  FROM lines WHERE LOWER(name) LIKE '%mochila%'   LIMIT 1;
  SELECT id INTO v_line_perfumes  FROM lines WHERE LOWER(name) LIKE '%perfume%'   LIMIT 1;

  -- Obtener IDs de tiendas
  SELECT id INTO v_store_mujeres FROM stores WHERE UPPER(code) LIKE '%MUJERES%' LIMIT 1;
  SELECT id INTO v_store_hombres FROM stores WHERE UPPER(code) LIKE '%HOMBRES%' LIMIT 1;

  RAISE NOTICE 'Líneas: Mujeres=%, Hombres=%, Niños=%, Accesorios=%, Mochilas=%, Perfumes=%',
    v_line_mujeres, v_line_hombres, v_line_ninos, v_line_accesorios, v_line_mochilas, v_line_perfumes;
  RAISE NOTICE 'Tiendas: Mujeres=%, Hombres=%', v_store_mujeres, v_store_hombres;

  -- ─── 2. Asegurarse de que Mujeres existe ───────────────────────────────────
  IF v_line_mujeres IS NULL THEN
    INSERT INTO lines (name, description, active)
    VALUES ('Mujeres', 'Ropa femenina', true)
    RETURNING id INTO v_line_mujeres;
    RAISE NOTICE 'Línea Mujeres creada: %', v_line_mujeres;
  END IF;

  IF v_line_hombres IS NULL THEN
    INSERT INTO lines (name, description, active)
    VALUES ('Hombres', 'Ropa masculina', true)
    RETURNING id INTO v_line_hombres;
    RAISE NOTICE 'Línea Hombres creada: %', v_line_hombres;
  END IF;

  IF v_line_ninos IS NULL THEN
    INSERT INTO lines (name, description, active)
    VALUES ('Niños', 'Ropa infantil', true)
    RETURNING id INTO v_line_ninos;
    RAISE NOTICE 'Línea Niños creada: %', v_line_ninos;
  END IF;

  -- ─── 3. Crear categorías para las ex-líneas si no existen ──────────────────
  -- Accesorios → categoría dentro de Mujeres
  IF v_line_accesorios IS NOT NULL THEN
    SELECT id INTO v_cat_accesorios
    FROM categories WHERE LOWER(name) LIKE '%accesorio%' AND line_id = v_line_mujeres LIMIT 1;

    IF v_cat_accesorios IS NULL THEN
      INSERT INTO categories (name, line_id, description, active)
      VALUES ('Accesorios', v_line_mujeres, 'Bolsos, cinturones, etc.', true)
      RETURNING id INTO v_cat_accesorios;
      RAISE NOTICE 'Categoría Accesorios creada: %', v_cat_accesorios;
    END IF;
  END IF;

  -- Mochilas → categoría dentro de Mujeres (o Hombres, lo ponemos en Mujeres de base)
  IF v_line_mochilas IS NOT NULL THEN
    SELECT id INTO v_cat_mochilas
    FROM categories WHERE LOWER(name) LIKE '%mochila%' AND line_id = v_line_mujeres LIMIT 1;

    IF v_cat_mochilas IS NULL THEN
      INSERT INTO categories (name, line_id, description, active)
      VALUES ('Mochilas', v_line_mujeres, 'Mochilas y bolsos escolares', true)
      RETURNING id INTO v_cat_mochilas;
      RAISE NOTICE 'Categoría Mochilas creada: %', v_cat_mochilas;
    END IF;
  END IF;

  -- Perfumes → categoría dentro de Mujeres
  IF v_line_perfumes IS NOT NULL THEN
    SELECT id INTO v_cat_perfumes
    FROM categories WHERE LOWER(name) LIKE '%perfume%' AND line_id = v_line_mujeres LIMIT 1;

    IF v_cat_perfumes IS NULL THEN
      INSERT INTO categories (name, line_id, description, active)
      VALUES ('Perfumes', v_line_mujeres, 'Fragancias y perfumes', true)
      RETURNING id INTO v_cat_perfumes;
      RAISE NOTICE 'Categoría Perfumes creada: %', v_cat_perfumes;
    END IF;
  END IF;

  -- ─── 4. Reasignar productos de las ex-líneas a Mujeres ─────────────────────
  IF v_line_accesorios IS NOT NULL THEN
    UPDATE products
    SET line_id = v_line_mujeres,
        category_id = COALESCE(v_cat_accesorios, category_id)
    WHERE line_id = v_line_accesorios;
    RAISE NOTICE 'Productos de Accesorios reasignados a Mujeres';
  END IF;

  IF v_line_mochilas IS NOT NULL THEN
    UPDATE products
    SET line_id = v_line_mujeres,
        category_id = COALESCE(v_cat_mochilas, category_id)
    WHERE line_id = v_line_mochilas;
    RAISE NOTICE 'Productos de Mochilas reasignados a Mujeres';
  END IF;

  IF v_line_perfumes IS NOT NULL THEN
    UPDATE products
    SET line_id = v_line_mujeres,
        category_id = COALESCE(v_cat_perfumes, category_id)
    WHERE line_id = v_line_perfumes;
    RAISE NOTICE 'Productos de Perfumes reasignados a Mujeres';
  END IF;

  -- ─── 5. Actualizar line_stores ────────────────────────────────────────────
  -- Limpiar todas las asociaciones y reconfigurar
  DELETE FROM line_stores WHERE TRUE;

  -- Mujeres → Tienda Mujeres
  IF v_store_mujeres IS NOT NULL THEN
    INSERT INTO line_stores (line_id, store_id)
    VALUES (v_line_mujeres, v_store_mujeres)
    ON CONFLICT DO NOTHING;

    -- Niños → Tienda Mujeres también
    INSERT INTO line_stores (line_id, store_id)
    VALUES (v_line_ninos, v_store_mujeres)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Hombres → Tienda Hombres
  IF v_store_hombres IS NOT NULL THEN
    INSERT INTO line_stores (line_id, store_id)
    VALUES (v_line_hombres, v_store_hombres)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'line_stores actualizado';

  -- ─── 6. Desactivar (NO eliminar) las líneas sobrantes ────────────────────
  -- Usamos desactivar para no perder historial. Puedes hacer DELETE si quieres.
  IF v_line_accesorios IS NOT NULL THEN
    UPDATE lines SET active = false WHERE id = v_line_accesorios;
  END IF;
  IF v_line_mochilas IS NOT NULL THEN
    UPDATE lines SET active = false WHERE id = v_line_mochilas;
  END IF;
  IF v_line_perfumes IS NOT NULL THEN
    UPDATE lines SET active = false WHERE id = v_line_perfumes;
  END IF;

  RAISE NOTICE '✅ Migración completada. Líneas activas: Mujeres, Hombres, Niños';

END $$;

COMMIT;
