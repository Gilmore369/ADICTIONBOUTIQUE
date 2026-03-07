# SOLUCIÓN: Upload de Logo Funcionando

## Problema Resuelto
El botón "Seleccionar Imagen" no abría el diálogo de archivos en Windows.

## Solución Implementada

### 1. Múltiples Métodos de Upload
- **Click en el cuadro de preview**: Ahora puedes hacer click directamente en el cuadro donde se muestra el logo
- **Botón "Seleccionar Imagen"**: Mejorado con mejor manejo de eventos
- **Drag & Drop**: Arrastra y suelta la imagen directamente en el cuadro

### 2. Guardado Dual
- **localStorage**: Para uso inmediato en el navegador
- **Servidor**: Guardado en `public/images/logo.png` para PDFs

### 3. Feedback Visual
- Indicador de "Subiendo..." mientras se procesa
- Cambio de color cuando arrastras una imagen
- Mensajes de éxito/error claros

## Cómo Usar

### Método 1: Click Directo (MÁS FÁCIL)
1. Ve a la página de Configuración
2. Haz click en el cuadro gris donde dice "Click o arrastra"
3. Selecciona tu imagen
4. ¡Listo!

### Método 2: Drag & Drop (MÁS RÁPIDO)
1. Abre la carpeta donde está tu logo
2. Arrastra la imagen al cuadro gris
3. Suelta la imagen
4. ¡Listo!

### Método 3: Botón
1. Haz click en "Seleccionar Imagen"
2. Selecciona tu imagen
3. ¡Listo!

## Logo Ya Instalado
El logo `addiction boutique.jpg` ya está copiado a `public/images/logo.png` y listo para usar.

## Próximos Pasos

### 1. Reiniciar el Servidor (IMPORTANTE)
Para que el logo aparezca en los PDFs, debes reiniciar el servidor Next.js:

```bash
# Detener el servidor (Ctrl+C en la terminal)
# Luego iniciar de nuevo:
npm run dev
```

### 2. Probar el Upload
1. Ve a Configuración
2. Prueba subir una imagen usando cualquiera de los 3 métodos
3. Verifica que aparezca el preview
4. Deberías ver el mensaje "Logo guardado exitosamente"

### 3. Probar el PDF
1. Ve al POS
2. Realiza una venta de prueba
3. Genera el ticket PDF
4. Verifica que el logo aparezca en el PDF

## Archivos Modificados
- `components/settings/settings-form.tsx`: Agregado drag & drop y mejor manejo de eventos
- `app/api/settings/upload-logo/route.ts`: Nuevo endpoint para guardar logo en servidor
- `public/images/logo.png`: Logo copiado y listo para usar

## Notas Técnicas
- El logo se guarda siempre como `logo.png` (sobrescribe el anterior)
- Tamaño máximo: 2MB
- Formatos soportados: JPG, PNG, GIF, SVG
- El servidor debe reiniciarse para cargar el nuevo logo en memoria
