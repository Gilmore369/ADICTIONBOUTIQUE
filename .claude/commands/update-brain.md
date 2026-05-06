# /update-brain — Actualizar el cerebro de Obsidian con el progreso de esta sesión

Guarda lo aprendido y avanzado en esta sesión en los archivos del cerebro Obsidian.

## Proceso

### 1. Revisar qué se hizo en esta sesión
- Repasar los archivos modificados (`git diff --stat HEAD~3..HEAD` o similar)
- Identificar bugs corregidos, features agregadas, migraciones aplicadas

### 2. Actualizar `01 - ERP Adiction Boutique.md`

Archivo: `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/Proyectos/01 - ERP Adiction Boutique.md`

Actualizar:
- **Estado actual** — cambiar porcentaje si aplica
- **Lista de bugs corregidos** — agregar nuevos bugs con su fix
- **Estado de migraciones** — marcar las nuevas como ✅
- **Pendientes** — marcar como completados lo que se resolvió, agregar nuevos
- **`updated:`** en el frontmatter con la fecha de hoy

### 3. Crear nota de sesión

Crear: `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/Sesiones/Sesion YYYY-MM-DD - [tema].md`

Formato:
```markdown
---
tags: [sesion, erp, boutique]
fecha: YYYY-MM-DD
proyecto: "[[Proyectos/01 - ERP Adiction Boutique]]"
---

# Sesión YYYY-MM-DD — [Tema principal]

## Resumen
[1-2 oraciones de qué se hizo]

## Lo que se hizo
- [item 1]
- [item 2]

## Archivos modificados
- `ruta/al/archivo.tsx` — descripción del cambio

## Pendiente para próxima sesión
- [ ] [tarea 1]
```

### 4. Actualizar `Skills Pendientes.md`

Archivo: `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/Skills/Skills Pendientes.md`

- Marcar como `[x]` las tareas completadas en esta sesión
- Agregar nuevas tareas identificadas en la sección correspondiente
- Mover items completados a la sección "✅ Completado recientemente"

### 5. Actualizar `INDEX.md`

Archivo: `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/INDEX.md`

- Agregar la nueva sesión al historial
- Actualizar fecha de última actualización
- Actualizar estado del proyecto si cambió

### Nota importante
El vault de Obsidian está en:
`C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/`

Si Obsidian está abierto, los cambios se sincronizarán automáticamente.
NO editar `graph.json` con Obsidian abierto.
