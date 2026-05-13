/**
 * Script to fix primary images in Supabase
 * This script marks existing images as primary when no primary image exists for a model
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function fixPrimaryImages() {
  console.log('🔧 Iniciando corrección de imágenes principales...')
  
  try {
    // 1. Verificar estado actual
    console.log('\n📊 Estado actual:')
    const { data: currentState } = await supabase.rpc('execute_sql', {
      query: `
        SELECT 
          'ANTES DE LA CORRECCIÓN' as estado,
          (SELECT COUNT(*) FROM product_images) as total_imagenes,
          (SELECT COUNT(DISTINCT base_code) FROM product_images) as modelos_con_imagenes,
          (SELECT COUNT(*) FROM product_images WHERE is_primary = true) as imagenes_principales,
          (SELECT COUNT(*) FROM product_images WHERE color IS NOT NULL) as imagenes_con_color;
      `
    })
    console.log(currentState)

    // 2. Ejecutar la corrección
    console.log('\n🔄 Ejecutando corrección...')
    const { data: updateResult, error: updateError } = await supabase.rpc('execute_sql', {
      query: `
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
      `
    })

    if (updateError) {
      console.error('❌ Error en la actualización:', updateError)
      return
    }

    console.log('✅ Corrección ejecutada exitosamente')

    // 3. Verificar resultado
    console.log('\n📊 Estado después de la corrección:')
    const { data: finalState } = await supabase.rpc('execute_sql', {
      query: `
        SELECT 
          'DESPUÉS DE LA CORRECCIÓN' as estado,
          (SELECT COUNT(*) FROM product_images) as total_imagenes,
          (SELECT COUNT(DISTINCT base_code) FROM product_images) as modelos_con_imagenes,
          (SELECT COUNT(*) FROM product_images WHERE is_primary = true) as imagenes_principales,
          (SELECT COUNT(*) FROM product_images WHERE color IS NOT NULL) as imagenes_con_color;
      `
    })
    console.log(finalState)

    // 4. Mostrar imágenes marcadas como principales
    console.log('\n📸 Imágenes marcadas como principales:')
    const { data: primaryImages } = await supabase.rpc('execute_sql', {
      query: `
        SELECT 
          base_code,
          id,
          storage_path,
          is_primary,
          created_at
        FROM product_images 
        WHERE is_primary = true
        ORDER BY base_code;
      `
    })
    console.log(primaryImages)

    console.log('\n🎉 ¡Corrección completada exitosamente!')
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixPrimaryImages()