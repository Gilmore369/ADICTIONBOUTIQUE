# Migración: Lista Negra de Clientes

## ¿Qué hace esta migración?

Agrega los campos necesarios a la tabla `clients` para gestionar la lista negra:
- `blacklisted_at`: Fecha y hora cuando el cliente fue bloqueado
- `blacklisted_reason`: Motivo del bloqueo (DEUDA_EXCESIVA, NO_PAGA, DECISION_GERENCIA, MAL_COMPORTAMIENTO, OTRO)
- `blacklisted_by`: Usuario que bloqueó al cliente

## Instrucciones

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en https://supabase.com
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido del archivo: `supabase/migrations/20260306000001_add_blacklist_fields.sql`
5. Haz clic en **Run** para ejecutar la migración

### Opción 2: Desde la línea de comandos

Si tienes Supabase CLI instalado:

```bash
supabase db push
```

O ejecuta directamente el archivo SQL:

```bash
psql -h [TU_HOST] -U postgres -d postgres -f supabase/migrations/20260306000001_add_blacklist_fields.sql
```

## Verificación

Después de ejecutar la migración, verifica que los campos se crearon correctamente:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
  AND column_name IN ('blacklisted_at', 'blacklisted_reason', 'blacklisted_by');
```

Deberías ver 3 filas con los nuevos campos.

## Funcionalidades Implementadas

Una vez ejecutada la migración, tendrás acceso a:

1. **Página de Lista Negra** (`/clients/blacklist`)
   - Ver todos los clientes bloqueados
   - Estadísticas de clientes bloqueados
   - Búsqueda y filtros

2. **Agregar a Lista Negra**
   - Seleccionar cualquier cliente activo
   - Especificar motivo del bloqueo
   - Agregar notas adicionales

3. **Desbloquear Cliente**
   - Remover cliente de lista negra
   - Agregar motivo del desbloqueo
   - Cliente puede volver a comprar a crédito

4. **Validación en POS**
   - El POS ya valida si un cliente está en lista negra
   - Bloquea automáticamente ventas a crédito para clientes bloqueados

## Acceso

La funcionalidad está disponible en:
- Menú lateral: **Clientes > Lista Negra**
- URL directa: `/clients/blacklist`

## Permisos

Solo usuarios con rol `admin` o `vendedor` pueden:
- Ver la lista negra
- Agregar clientes a lista negra
- Desbloquear clientes
