-- ============================================================================
-- VERIFICAR / AGREGAR columna email en clients
-- ============================================================================
-- La tabla clients debería tener email. Si no existe, se agrega.
-- Es seguro re-ejecutar (IF NOT EXISTS).
-- ============================================================================

-- Asegurar columna email en clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Índice para búsqueda por email
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)
  WHERE email IS NOT NULL;

-- ============================================================================
-- ASEGURAR columnas GMAIL en .env.local (recordatorio)
-- ============================================================================
-- Agregar en .env.local (y en VPS /var/www/ADICTIONBOUTIQUE/.env.local):
--
--   GMAIL_USER=gianpepex@gmail.com
--   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
--
-- Obtener contraseña de app: https://myaccount.google.com/apppasswords
-- (Google Account → Seguridad → Contraseñas de aplicaciones)
-- ============================================================================
