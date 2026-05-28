-- ============================================================
-- Actualiza get_clients_last_payment_date para aceptar lista
-- opcional de client_ids. Esto evita el límite de 1000 filas
-- de PostgREST al filtrar solo los clientes relevantes.
-- ============================================================

CREATE OR REPLACE FUNCTION get_clients_last_payment_date(p_client_ids UUID[] DEFAULT NULL)
RETURNS TABLE(client_id UUID, last_payment DATE)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT client_id, MAX(payment_date)::DATE AS last_payment
  FROM payments
  WHERE client_id IS NOT NULL
    AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
  GROUP BY client_id;
$$;

GRANT EXECUTE ON FUNCTION get_clients_last_payment_date(UUID[]) TO authenticated, anon, service_role;
