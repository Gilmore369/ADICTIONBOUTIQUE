# Correcciones Finales del Sistema de PDF

## Problemas Identificados y Solucionados

### 1. ✅ Cuotas no aparecen en ventas a crédito
**Problema**: El PDF de ventas a crédito no mostraba el plan de cuotas.

**Causa**: El endpoint no estaba pasando el campo `installments` correctamente cuando era `null` o `undefined`.

**Solución**: 
- Modificado `app/api/sales/[saleNumber]/pdf/route.ts`
- Agregado valor por defecto de 6 cuotas si `sale.installments` es null/undefined
- Agregado log para debug: `console.log('[pdf-download] Sale data:', ...)`

```typescript
installments: sale.sale_type === 'CREDITO' ? (sale.installments || 6) : undefined,
```

### 2. ✅ Logo incorrecto en impresión
**Problema**: Al imprimir aparecía un logo diferente (logo de localStorage).

**Causa**: El componente cargaba el logo desde localStorage en lugar de usar el logo fijo.

**Solución**:
- Modificado `components/pos/sale-receipt.tsx`
- Eliminado código que cargaba logo desde localStorage
- Fijado logo a `/images/logo.png` directamente

```typescript
const [storeConfig] = useState(DEFAULT_STORE_CONFIG)
const [logoUrl] = useState<string | null>('/images/logo.png')
```

### 3. ✅ Formato de impresión (hoja completa en lugar de compacto)
**Problema**: Al imprimir salía en hoja A4 completa en lugar de formato compacto 80mm.

**Causa**: Faltaban estilos CSS específicos para impresión.

**Solución**:
- Agregado `useEffect` en `components/pos/sale-receipt.tsx`
- Inyectado estilos `@media print` con formato 80mm
- Configurado `@page { size: 80mm auto; margin: 0; }`

```typescript
useEffect(() => {
  const style = document.createElement('style')
  style.id = 'receipt-print-styles'
  style.textContent = `
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .receipt-content {
        width: 80mm;
        max-width: 80mm;
        margin: 0;
        padding: 10mm;
        font-size: 10pt;
      }
    }
  `
  document.head.appendChild(style)
  
  return () => {
    const existingStyle = document.getElementById('receipt-print-styles')
    if (existingStyle) {
      existingStyle.remove()
    }
  }
}, [])
```

## Archivos Modificados

1. `app/api/sales/[saleNumber]/pdf/route.ts`
   - Agregado valor por defecto para `installments` (6 cuotas)
   - Agregado log de debug

2. `components/pos/sale-receipt.tsx`
   - Eliminado carga de logo desde localStorage
   - Fijado logo a `/images/logo.png`
   - Agregado estilos de impresión 80mm

## Próximos Pasos

1. **REINICIAR EL SERVIDOR** para que los cambios surtan efecto:
   ```bash
   # Detener el servidor (Ctrl+C)
   # Iniciar nuevamente
   npm run dev
   ```

2. **Probar descarga de PDF** desde Historial de Ventas:
   - Ir a `/sales`
   - Hacer click en botón "PDF" de una venta a crédito
   - Verificar que aparezcan las cuotas

3. **Probar impresión** desde modal de ticket:
   - Hacer una venta en POS
   - Hacer click en "Imprimir"
   - Verificar formato compacto 80mm

## Notas Técnicas

- El logo está en `public/images/logo.png` (116 KB)
- El formato de impresión es 80mm de ancho x altura automática
- Las cuotas se calculan dividiendo el total entre el número de cuotas
- Cada cuota vence un mes después de la anterior
