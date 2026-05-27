-- ============================================================
-- get_clients_last_payment_date()
-- Devuelve { client_id, last_payment } para TODOS los clientes con
-- al menos un pago. Sirve para categorizar deudas por antigüedad
-- (más de 1 año sin pagos, más de 3, etc.).
--
-- Performance: single GROUP BY sobre payments (108k+ rows).
-- Si la tabla crece mucho, considerar índice en (client_id, payment_date).
-- ============================================================

CREATE OR REPLACE FUNCTION get_clients_last_payment_date()
RETURNS TABLE(client_id UUID, last_payment DATE)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT client_id, MAX(payment_date)::DATE AS last_payment
  FROM payments
  WHERE client_id IS NOT NULL
  GROUP BY client_id;
$$;

GRANT EXECUTE ON FUNCTION get_clients_last_payment_date() TO authenticated, anon, service_role;
