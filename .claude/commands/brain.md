# /brain — Cargar contexto completo del ERP Adiction Boutique

Lee el cerebro de Obsidian y carga todo el contexto del proyecto en memoria para esta sesión.

## Archivos a leer (en este orden)

1. `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/Proyectos/01 - ERP Adiction Boutique.md`
   — Documento maestro: stack, reglas críticas, descripción de secciones, estado actual, pendientes

2. `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/Skills/Skills Pendientes.md`
   — Backlog de tareas pendientes para el ERP

3. `C:/Users/franc/OneDrive/Documents/Obsidian Vault/🧠 Claude Brain/Sesiones/Sesion 2026-05-06 - ERP Boutique Auditoria y Deploy.md`
   — Última sesión de trabajo: qué se hizo, qué quedó pendiente

## Después de leer

Presenta un resumen estructurado con:
- **Estado actual del proyecto** (% completado, en producción o no)
- **Secciones completadas** (lista breve)
- **Pendientes** (qué falta hacer, en orden de prioridad)
- **Reglas críticas** que aplican a la próxima tarea
- **Pregunta**: "¿Qué quieres hacer hoy con el ERP?"

## Contexto rápido (sin leer archivos)
Si los archivos no están disponibles, usa este resumen de memoria:

```
ERP Adiction Boutique — Next.js + Supabase — 95% completo — EN PRODUCCIÓN
URL: https://adicionboutique.agsys.es
VPS: 18.224.29.109 | /var/www/ADICTIONBOUTIQUE | PM2: adiction-boutique
GitHub: https://github.com/Gilmore369/ADICTIONBOUTIQUE (master)
Código: C:/Users/franc/OneDrive/Escritorio/SISTEMAS COPIAS/SISTEMA_BOUTIQUE/supa/

REGLAS CRÍTICAS:
- Zod v4: NO usar .uuid() .email() .datetime() — usar lib/validations/zod-compat.ts
- Dark mode: tokens semánticos (bg-card, text-foreground) NO hardcoded
- Timezone: America/Lima en todo — getTodayPeru() en JS, AT TIME ZONE en SQL
- Supabase: 3 clients (browser/server/service) según contexto

PENDIENTE PRINCIPAL:
- QA visual en modo oscuro con usuario admin real
- Tests E2E Playwright completos
```
