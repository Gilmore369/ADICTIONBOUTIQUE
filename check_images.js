const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkImages() {
  console.log('🔍 Verificando estado de imágenes...\n');
  
  try {
    // 1. Estado general
    const { data: general } = await supabase
      .from('product_images')
      .select('*');
    
    console.log('📊 ESTADO GENERAL:');
    console.log('Total imágenes:', general?.length || 0);
    console.log('Imágenes principales:', general?.filter(img => img.is_primary).length || 0);
    console.log('Imágenes con color:', general?.filter(img => img.color).length || 0);
    
    // 2. Por modelo
    console.log('\n📋 IMÁGENES POR MODELO:');
    const modelGroups = {};
    general?.forEach(img => {
      if (!modelGroups[img.base_code]) {
        modelGroups[img.base_code] = { total: 0, primary: 0, withColor: 0, colors: [] };
      }
      modelGroups[img.base_code].total++;
      if (img.is_primary) modelGroups[img.base_code].primary++;
      if (img.color) {
        modelGroups[img.base_code].withColor++;
        if (!modelGroups[img.base_code].colors.includes(img.color)) {
          modelGroups[img.base_code].colors.push(img.color);
        }
      }
    });
    
    Object.entries(modelGroups).forEach(([baseCode, stats]) => {
      console.log(`${baseCode}: ${stats.total} imágenes, ${stats.primary} principales, colores: [${stats.colors.join(', ')}]`);
    });

    // 3. Ejecutar corrección de imágenes principales
    console.log('\n🔧 Ejecutando corrección de imágenes principales...');
    
    const { data: updateResult, error: updateError } = await supabase
      .rpc('execute_sql', {
        sql: `
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
      });

    if (updateError) {
      console.error('❌ Error en la corrección:', updateError);
    } else {
      console.log('✅ Corrección ejecutada exitosamente');
    }

    // 4. Verificar estado después de la corrección
    const { data: afterCorrection } = await supabase
      .from('product_images')
      .select('*');
    
    console.log('\n📊 ESTADO DESPUÉS DE LA CORRECCIÓN:');
    console.log('Total imágenes:', afterCorrection?.length || 0);
    console.log('Imágenes principales:', afterCorrection?.filter(img => img.is_primary).length || 0);
    console.log('Imágenes con color:', afterCorrection?.filter(img => img.color).length || 0);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkImages();