-- Migration: Update Clients to Trujillo
-- Description: Delete Lima clients and add Trujillo clients
-- Date: 2026-02-20

-- ============================================================================
-- DELETE EXISTING DATA (in reverse order of dependencies)
-- ============================================================================

-- Delete collection actions first
DELETE FROM collection_actions;

-- Delete payments
DELETE FROM payments;

-- Delete installments
DELETE FROM installments;

-- Delete credit plans
DELETE FROM credit_plans;

-- Delete sale items
DELETE FROM sale_items;

-- Delete sales
DELETE FROM sales;

-- Finally delete clients
DELETE FROM clients;

-- ============================================================================
-- INSERT NEW CLIENTS (Trujillo and districts)
-- ============================================================================

INSERT INTO clients (id, dni, name, phone, email, address, lat, lng, credit_limit, credit_used, birthday) VALUES
-- Trujillo Centro
('b50e8400-e29b-41d4-a716-446655440001', '12345678', 'Ana María Torres', '987654321', 'ana.torres@email.com', 'Jr. Pizarro 456, Trujillo', -8.1116, -79.0288, 2000.00, 500.00, '1990-05-15'),
('b50e8400-e29b-41d4-a716-446655440002', '23456789', 'Carlos Mendoza', '987654322', 'carlos.mendoza@email.com', 'Av. España 789, Trujillo', -8.1089, -79.0250, 1500.00, 800.00, '1985-08-20'),
-- La Esperanza
('b50e8400-e29b-41d4-a716-446655440003', '34567890', 'Lucía Fernández', '987654323', 'lucia.fernandez@email.com', 'Av. Túpac Amaru 234, La Esperanza', -8.0850, -79.0350, 3000.00, 1200.00, '1992-03-10'),
('b50e8400-e29b-41d4-a716-446655440004', '45678901', 'Roberto Silva', '987654324', 'roberto.silva@email.com', 'Jr. Los Pinos 567, La Esperanza', -8.0900, -79.0400, 2500.00, 1800.00, '1988-11-25'),
-- El Porvenir
('b50e8400-e29b-41d4-a716-446655440005', '56789012', 'Patricia Ramos', '987654325', 'patricia.ramos@email.com', 'Av. Miraflores 890, El Porvenir', -8.0950, -79.0100, 1800.00, 900.00, '1995-07-08'),
('b50e8400-e29b-41d4-a716-446655440006', '67890123', 'Miguel Ángel Cruz', '987654326', 'miguel.cruz@email.com', 'Jr. Las Flores 123, El Porvenir', -8.1000, -79.0150, 2200.00, 1500.00, '1987-12-03'),
-- Víctor Larco
('b50e8400-e29b-41d4-a716-446655440007', '78901234', 'Carmen Rosa Díaz', '987654327', 'carmen.diaz@email.com', 'Av. Larco 345, Víctor Larco', -8.1350, -79.0350, 2800.00, 2000.00, '1991-09-18'),
('b50e8400-e29b-41d4-a716-446655440008', '89012345', 'José Luis Vargas', '987654328', 'jose.vargas@email.com', 'Jr. Buenos Aires 678, Víctor Larco', -8.1400, -79.0300, 2000.00, 1100.00, '1993-04-22');

-- ============================================================================
-- VERIFY CHANGES
-- ============================================================================

SELECT 
  id,
  name,
  address,
  lat,
  lng,
  credit_used,
  credit_limit
FROM clients
ORDER BY name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ CLIENTS UPDATED TO TRUJILLO!' as result;
SELECT 'Total clients: 8 (Trujillo, La Esperanza, El Porvenir, Víctor Larco)' as info;
