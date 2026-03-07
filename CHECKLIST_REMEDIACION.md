# CHECKLIST DE REMEDIACIÓN - AUDITORÍA DE SEGURIDAD
## Tracking de progreso por fase

---

## FASE 1: CRÍTICO - INMEDIATO (Esta Semana)

### 🔴 C1: Exposición de Secretos en Repositorio
- [ ] Crear backup del repositorio
- [ ] Remover .env.local del historial de Git
- [ ] Crear .env.example (template)
- [ ] Actualizar .gitignore
- [ ] Rotar Supabase ANON_KEY
- [ ] Rotar Supabase SERVICE_ROLE_KEY
- [ ] Rotar Google Maps API Key
- [ ] Rotar Resend API Key
- [ ] Rotar credenciales de Gmail
- [ ] Actualizar .env.local con nuevas claves (NO commitear)
- [ ] Verificar que .env.local no está en Git
- [ ] Informar al equipo sobre cambios

**Tiempo estimado:** 2 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🔴 C2: RLS Deshabilitado en Supabase
- [ ] Hacer backup de base de datos
- [ ] Crear funciones helper (is_admin, has_role)
- [ ] Ejecutar migración RLS en Supabase SQL Editor
- [ ] Verificar que RLS está habilitado en todas las tablas
- [ ] Probar acceso con usuario sin roles (debe fallar)
- [ ] Probar acceso con usuario admin (debe funcionar)
- [ ] Probar acceso con usuario vendedor (debe funcionar)
- [ ] Probar acceso con usuario cajero (debe funcionar)
- [ ] Probar acceso con usuario cobrador (debe funcionar)
- [ ] Documentar cualquier issue encontrado
- [ ] Monitorear logs por 24 horas

**Tiempo estimado:** 4 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🔴 C3: Validación de Autorización Incompleta en APIs
- [ ] Crear backup de archivos afectados
- [ ] Actualizar app/api/client-actions/route.ts
- [ ] Actualizar app/api/collection-actions/route.ts
- [ ] Actualizar app/api/visits/route.ts
- [ ] Actualizar app/api/catalogs/brands/route.ts
- [ ] Actualizar app/api/catalogs/categories/route.ts
- [ ] Actualizar app/api/catalogs/lines/route.ts
- [ ] Actualizar app/api/catalogs/sizes/route.ts
- [ ] Actualizar app/api/catalogs/suppliers/route.ts
- [ ] Probar con usuario cajero (debe ser rechazado en cobranza)
- [ ] Probar con usuario cobrador (debe ser aceptado en cobranza)
- [ ] Probar con usuario admin (debe ser aceptado en todo)
- [ ] Verificar logs de auditoría

**Tiempo estimado:** 6 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🔴 C4: Configuración Insegura de Next.js
- [ ] Crear backup de next.config.ts
- [ ] Cambiar ignoreBuildErrors: false
- [ ] Instalar CLI de Supabase
- [ ] Generar tipos de Supabase
- [ ] Ejecutar npm run build
- [ ] Corregir errores de tipo reportados
- [ ] Verificar build exitoso
- [ ] Probar app en desarrollo
- [ ] Deploy a staging
- [ ] Verificar en staging
- [ ] Deploy a producción

**Tiempo estimado:** 8 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

**TOTAL FASE 1:** 20 horas  
**Fecha inicio:** _______________  
**Fecha completado:** _______________

---

## FASE 2: ALTO - CORTO PLAZO (Próximas 2 Semanas)

### 🟠 C5: Validación de Entrada Incompleta
- [ ] Crear lib/validations/api.ts
- [ ] Crear esquema Zod para visits
- [ ] Crear esquema Zod para credit-plans
- [ ] Crear esquema Zod para clients
- [ ] Aplicar validación en app/api/visits/route.ts
- [ ] Aplicar validación en app/api/credit-plans/search/route.ts
- [ ] Aplicar validación en app/api/clients/search/route.ts
- [ ] Probar con inputs válidos
- [ ] Probar con inputs inválidos (debe rechazar)
- [ ] Verificar mensajes de error

**Tiempo estimado:** 12 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟠 C6: Exposición de Información Sensible en Errores
- [ ] Crear lib/api/error-handler.ts
- [ ] Implementar handleApiError()
- [ ] Implementar handleValidationError()
- [ ] Aplicar en app/api/upload/product-image/route.ts
- [ ] Aplicar en app/api/payments/register/route.ts
- [ ] Aplicar en todos los endpoints de API
- [ ] Verificar que errores no exponen detalles internos
- [ ] Verificar que logs siguen teniendo detalles (para debugging)

**Tiempo estimado:** 8 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟠 C7: Falta de Rate Limiting por Usuario
- [ ] Actualizar lib/api/rate-limit.ts
- [ ] Implementar rateLimitUser()
- [ ] Actualizar proxy.ts
- [ ] Aplicar rate limiting por usuario (30 req/min)
- [ ] Probar con múltiples usuarios
- [ ] Verificar que rate limit por IP sigue funcionando
- [ ] Verificar header Retry-After

**Tiempo estimado:** 4 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟠 H1: Falta de CORS Restrictivo
- [ ] Crear middleware.ts
- [ ] Definir ALLOWED_ORIGINS
- [ ] Implementar CORS headers
- [ ] Agregar security headers (X-Frame-Options, etc.)
- [ ] Probar desde origen permitido (debe funcionar)
- [ ] Probar desde origen no permitido (debe rechazar)
- [ ] Verificar headers en respuesta

**Tiempo estimado:** 4 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟠 H2: Falta de Validación de Tamaño y Tipo de Archivo
- [ ] Crear lib/validations/upload.ts
- [ ] Implementar validateImageFile()
- [ ] Definir ALLOWED_IMAGE_TYPES
- [ ] Definir MAX_FILE_SIZE
- [ ] Aplicar en endpoints de upload
- [ ] Probar con imagen válida (debe aceptar)
- [ ] Probar con archivo no imagen (debe rechazar)
- [ ] Probar con archivo > 5MB (debe rechazar)

**Tiempo estimado:** 4 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟠 H3: Falta de Logging de Seguridad
- [ ] Crear tabla security_log en Supabase
- [ ] Crear índices en security_log
- [ ] Habilitar RLS en security_log
- [ ] Crear lib/security/security-logger.ts
- [ ] Implementar logSecurityEvent()
- [ ] Aplicar en login (success y failed)
- [ ] Aplicar en logout
- [ ] Aplicar en access denied
- [ ] Aplicar en rate limit exceeded
- [ ] Verificar que logs se crean correctamente
- [ ] Crear dashboard de visualización (opcional)

**Tiempo estimado:** 8 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

**TOTAL FASE 2:** 40 horas  
**Fecha inicio:** _______________  
**Fecha completado:** _______________

---

## FASE 3: MEDIO - MEDIANO PLAZO (Próximo Mes)

### 🟡 H4: Falta de Protección CSRF
- [ ] Crear lib/security/csrf.ts
- [ ] Implementar validateCSRF()
- [ ] Aplicar en actions/auth.ts
- [ ] Aplicar en actions/clients.ts
- [ ] Aplicar en actions/sales.ts
- [ ] Probar con origin válido (debe funcionar)
- [ ] Probar con origin inválido (debe rechazar)

**Tiempo estimado:** 4 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟡 H5: Falta de Sanitización de Inputs
- [ ] Instalar isomorphic-dompurify
- [ ] Crear lib/security/sanitize.ts
- [ ] Implementar sanitizeHTML()
- [ ] Implementar sanitizeText()
- [ ] Implementar sanitizeSQL()
- [ ] Aplicar en todos los inputs de usuario
- [ ] Probar con input malicioso (debe sanitizar)
- [ ] Verificar que no rompe funcionalidad

**Tiempo estimado:** 8 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟡 M1: Falta de Encriptación de Datos Sensibles
- [ ] Crear lib/security/encryption.ts
- [ ] Generar ENCRYPTION_KEY segura (32 bytes)
- [ ] Implementar encrypt()
- [ ] Implementar decrypt()
- [ ] Crear migración para encriptar datos existentes
- [ ] Encriptar DNI en tabla clients
- [ ] Encriptar teléfono en tabla clients
- [ ] Encriptar dirección en tabla clients
- [ ] Probar encriptación/desencriptación
- [ ] Verificar que app funciona correctamente

**Tiempo estimado:** 16 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟡 M2: Falta de Backup y Disaster Recovery
- [ ] Habilitar PITR en Supabase Dashboard
- [ ] Configurar retención de 7 días
- [ ] Crear scripts/backup-database.sh
- [ ] Configurar cron job para backups diarios
- [ ] Configurar upload a S3/storage externo
- [ ] Probar backup manual
- [ ] Probar restauración de backup
- [ ] Documentar proceso de recuperación

**Tiempo estimado:** 8 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟡 M3: Falta de Monitoreo y Alertas
- [ ] Crear cuenta en Sentry
- [ ] Instalar @sentry/nextjs
- [ ] Configurar sentry.client.config.ts
- [ ] Configurar sentry.server.config.ts
- [ ] Crear lib/security/alerts.ts
- [ ] Implementar sendSecurityAlert()
- [ ] Configurar webhook de Slack
- [ ] Definir umbrales de alerta
- [ ] Probar alertas de prueba
- [ ] Verificar que alertas llegan correctamente

**Tiempo estimado:** 12 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟡 M4: Falta de Pruebas de Seguridad Automatizadas
- [ ] Crear .github/workflows/security.yml
- [ ] Configurar npm audit
- [ ] Crear cuenta en Snyk
- [ ] Configurar Snyk en workflow
- [ ] Configurar OWASP Dependency Check
- [ ] Crear npm run lint:security
- [ ] Probar workflow localmente
- [ ] Verificar que workflow corre en CI/CD
- [ ] Configurar notificaciones de fallos

**Tiempo estimado:** 8 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

**TOTAL FASE 3:** 56 horas  
**Fecha inicio:** _______________  
**Fecha completado:** _______________

---

## FASE 4: MEJORAS - LARGO PLAZO (Mes 2+)

### 🟢 Implementar 2FA para usuarios admin
- [ ] Evaluar librerías de TOTP
- [ ] Implementar backend de 2FA
- [ ] Crear UI de configuración
- [ ] Implementar backup codes
- [ ] Probar con usuarios admin
- [ ] Documentar proceso

**Tiempo estimado:** 16 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟢 Implementar Web Application Firewall (WAF)
- [ ] Evaluar Cloudflare WAF vs AWS WAF
- [ ] Crear cuenta y configurar
- [ ] Configurar reglas de protección
- [ ] Configurar rate limiting global
- [ ] Probar con ataques simulados
- [ ] Monitorear por 1 semana

**Tiempo estimado:** 24 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟢 Penetration Testing
- [ ] Evaluar empresas de pentesting
- [ ] Contratar empresa
- [ ] Coordinar fechas de pruebas
- [ ] Ejecutar pruebas de penetración
- [ ] Revisar informe de hallazgos
- [ ] Remediar hallazgos críticos
- [ ] Remediar hallazgos altos
- [ ] Re-test de hallazgos

**Tiempo estimado:** 40 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

### 🟢 Certificación de Seguridad
- [ ] Evaluar ISO 27001 vs SOC 2
- [ ] Contratar consultor
- [ ] Implementar controles requeridos
- [ ] Preparar documentación
- [ ] Auditoría externa
- [ ] Remediar hallazgos
- [ ] Obtener certificación

**Tiempo estimado:** 160 horas  
**Responsable:** _______________  
**Fecha completado:** _______________

---

**TOTAL FASE 4:** 240 horas  
**Fecha inicio:** _______________  
**Fecha completado:** _______________

---

## RESUMEN DE PROGRESO

### Por Fase
- [ ] Fase 1: Crítico (20 horas) - ___% completado
- [ ] Fase 2: Alto (40 horas) - ___% completado
- [ ] Fase 3: Medio (56 horas) - ___% completado
- [ ] Fase 4: Mejoras (240 horas) - ___% completado

### Por Criticidad
- [ ] Críticos (7 hallazgos) - ___% completado
- [ ] Altos (12 hallazgos) - ___% completado
- [ ] Medios (8 hallazgos) - ___% completado
- [ ] Bajos (3 hallazgos) - ___% completado

### Total General
**Progreso:** ___% completado  
**Tiempo invertido:** ___ horas  
**Tiempo restante:** ___ horas

---

## NOTAS Y OBSERVACIONES

### Blockers identificados:
1. _______________
2. _______________
3. _______________

### Issues encontrados durante remediación:
1. _______________
2. _______________
3. _______________

### Cambios de alcance:
1. _______________
2. _______________
3. _______________

---

## APROBACIONES

### Fase 1 (Crítico)
- [ ] Revisado por: _______________
- [ ] Aprobado por: _______________
- [ ] Fecha: _______________

### Fase 2 (Alto)
- [ ] Revisado por: _______________
- [ ] Aprobado por: _______________
- [ ] Fecha: _______________

### Fase 3 (Medio)
- [ ] Revisado por: _______________
- [ ] Aprobado por: _______________
- [ ] Fecha: _______________

### Fase 4 (Mejoras)
- [ ] Revisado por: _______________
- [ ] Aprobado por: _______________
- [ ] Fecha: _______________

---

**Última actualización:** _______________  
**Próxima revisión:** _______________

