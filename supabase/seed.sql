-- Seed Data for Adiction Boutique Suite
-- Description: Populate database with initial test data
-- Date: 2024-01-01
-- 
-- IMPORTANT: This seed can be run multiple times safely
-- Uses ON CONFLICT DO NOTHING to prevent duplicate key errors

-- ============================================================================
-- CLEAN EXISTING DATA (in reverse order of dependencies)
-- ============================================================================

DELETE FROM collection_actions;
DELETE FROM payments;
DELETE FROM installments;
DELETE FROM credit_plans;
DELETE FROM sale_items;
DELETE FROM sales;
DELETE FROM movements;
DELETE FROM stock;
DELETE FROM clients;
DELETE FROM products;
DELETE FROM sizes;
DELETE FROM suppliers;
DELETE FROM brands;
DELETE FROM categories;
DELETE FROM lines;

-- ============================================================================
-- WAREHOUSES (TIENDAS)
-- ============================================================================

-- Note: Warehouses are stored as TEXT identifiers, not in a separate table
-- Common warehouse IDs: 'TIENDA_MUJERES', 'TIENDA_HOMBRES'

-- ============================================================================
-- LINES (LÍNEAS)
-- ============================================================================

INSERT INTO lines (id, name, description) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Ropa Dama', 'Línea de ropa para dama'),
('550e8400-e29b-41d4-a716-446655440002', 'Ropa Caballero', 'Línea de ropa para caballero'),
('550e8400-e29b-41d4-a716-446655440003', 'Accesorios', 'Línea de accesorios y complementos'),
('550e8400-e29b-41d4-a716-446655440004', 'Calzado', 'Línea de calzado');

-- ============================================================================
-- CATEGORIES (CATEGORÍAS)
-- ============================================================================

INSERT INTO categories (id, name, line_id, description) VALUES
-- Ropa Dama
('650e8400-e29b-41d4-a716-446655440001', 'Blusas', '550e8400-e29b-41d4-a716-446655440001', 'Blusas y camisas para dama'),
('650e8400-e29b-41d4-a716-446655440002', 'Pantalones', '550e8400-e29b-41d4-a716-446655440001', 'Pantalones para dama'),
('650e8400-e29b-41d4-a716-446655440003', 'Vestidos', '550e8400-e29b-41d4-a716-446655440001', 'Vestidos'),
-- Ropa Caballero
('650e8400-e29b-41d4-a716-446655440004', 'Camisas', '550e8400-e29b-41d4-a716-446655440002', 'Camisas para caballero'),
('650e8400-e29b-41d4-a716-446655440005', 'Pantalones', '550e8400-e29b-41d4-a716-446655440002', 'Pantalones para caballero'),
-- Accesorios
('650e8400-e29b-41d4-a716-446655440006', 'Carteras', '550e8400-e29b-41d4-a716-446655440003', 'Carteras y bolsos'),
('650e8400-e29b-41d4-a716-446655440007', 'Cinturones', '550e8400-e29b-41d4-a716-446655440003', 'Cinturones'),
-- Calzado
('650e8400-e29b-41d4-a716-446655440008', 'Zapatos Dama', '550e8400-e29b-41d4-a716-446655440004', 'Zapatos para dama'),
('650e8400-e29b-41d4-a716-446655440009', 'Zapatos Caballero', '550e8400-e29b-41d4-a716-446655440004', 'Zapatos para caballero');

-- ============================================================================
-- BRANDS (MARCAS)
-- ============================================================================

INSERT INTO brands (id, name, description) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Zara', 'Marca internacional de moda'),
('750e8400-e29b-41d4-a716-446655440002', 'H&M', 'Marca sueca de moda'),
('750e8400-e29b-41d4-a716-446655440003', 'Forever 21', 'Marca americana de moda'),
('750e8400-e29b-41d4-a716-446655440004', 'Mango', 'Marca española de moda'),
('750e8400-e29b-41d4-a716-446655440005', 'Pull&Bear', 'Marca casual urbana');

-- ============================================================================
-- SIZES (TALLAS)
-- ============================================================================

INSERT INTO sizes (id, name, category_id) VALUES
-- Blusas
('850e8400-e29b-41d4-a716-446655440001', 'XS', '650e8400-e29b-41d4-a716-446655440001'),
('850e8400-e29b-41d4-a716-446655440002', 'S', '650e8400-e29b-41d4-a716-446655440001'),
('850e8400-e29b-41d4-a716-446655440003', 'M', '650e8400-e29b-41d4-a716-446655440001'),
('850e8400-e29b-41d4-a716-446655440004', 'L', '650e8400-e29b-41d4-a716-446655440001'),
('850e8400-e29b-41d4-a716-446655440005', 'XL', '650e8400-e29b-41d4-a716-446655440001'),
-- Pantalones Dama
('850e8400-e29b-41d4-a716-446655440006', '26', '650e8400-e29b-41d4-a716-446655440002'),
('850e8400-e29b-41d4-a716-446655440007', '28', '650e8400-e29b-41d4-a716-446655440002'),
('850e8400-e29b-41d4-a716-446655440008', '30', '650e8400-e29b-41d4-a716-446655440002'),
('850e8400-e29b-41d4-a716-446655440009', '32', '650e8400-e29b-41d4-a716-446655440002');

-- ============================================================================
-- SUPPLIERS (PROVEEDORES)
-- ============================================================================

INSERT INTO suppliers (id, name, contact_name, phone, email, address) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'Distribuidora Lima SAC', 'Juan Pérez', '987654321', 'ventas@distlima.com', 'Av. Argentina 1234, Lima'),
('950e8400-e29b-41d4-a716-446655440002', 'Importaciones del Sur', 'María García', '987654322', 'contacto@impsur.com', 'Jr. Cusco 567, Lima'),
('950e8400-e29b-41d4-a716-446655440003', 'Textiles Peruanos', 'Carlos Rodríguez', '987654323', 'info@textilesperu.com', 'Av. Colonial 890, Lima');

-- ============================================================================
-- PRODUCTS (PRODUCTOS)
-- ============================================================================

INSERT INTO products (id, barcode, name, description, line_id, category_id, brand_id, supplier_id, size, color, presentation, purchase_price, price, min_stock, entry_date) VALUES
-- Blusas
('a50e8400-e29b-41d4-a716-446655440001', '7501234567890', 'Blusa Casual Blanca', 'Blusa casual de algodón', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 'M', 'Blanco', 'Unidad', 35.00, 69.90, 5, '2024-01-01'),
('a50e8400-e29b-41d4-a716-446655440002', '7501234567891', 'Blusa Elegante Negra', 'Blusa elegante para ocasiones especiales', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', 'S', 'Negro', 'Unidad', 45.00, 89.90, 3, '2024-01-01'),
-- Pantalones
('a50e8400-e29b-41d4-a716-446655440003', '7501234567892', 'Jean Skinny Azul', 'Jean ajustado color azul', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440002', '28', 'Azul', 'Unidad', 55.00, 119.90, 4, '2024-01-01'),
('a50e8400-e29b-41d4-a716-446655440004', '7501234567893', 'Pantalón Formal Negro', 'Pantalón de vestir', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440002', '30', 'Negro', 'Unidad', 60.00, 129.90, 3, '2024-01-01'),
-- Vestidos
('a50e8400-e29b-41d4-a716-446655440005', '7501234567894', 'Vestido Floral Verano', 'Vestido estampado floral', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440003', 'M', 'Multicolor', 'Unidad', 70.00, 149.90, 2, '2024-01-01'),
-- Camisas Caballero
('a50e8400-e29b-41d4-a716-446655440006', '7501234567895', 'Camisa Formal Blanca', 'Camisa de vestir manga larga', '550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 'L', 'Blanco', 'Unidad', 40.00, 79.90, 5, '2024-01-01'),
('a50e8400-e29b-41d4-a716-446655440007', '7501234567896', 'Camisa Casual Azul', 'Camisa casual manga corta', '550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', 'M', 'Azul', 'Unidad', 35.00, 69.90, 4, '2024-01-01'),
-- Accesorios
('a50e8400-e29b-41d4-a716-446655440008', '7501234567897', 'Cartera Cuero Marrón', 'Cartera de cuero genuino', '550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440003', 'Única', 'Marrón', 'Unidad', 80.00, 169.90, 2, '2024-01-01'),
('a50e8400-e29b-41d4-a716-446655440009', '7501234567898', 'Cinturón Cuero Negro', 'Cinturón de cuero con hebilla', '550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440003', 'Única', 'Negro', 'Unidad', 25.00, 49.90, 6, '2024-01-01'),
-- Calzado
('a50e8400-e29b-41d4-a716-446655440010', '7501234567899', 'Zapatos Tacón Alto', 'Zapatos de tacón para dama', '550e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440008', '750e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440002', '37', 'Negro', 'Par', 90.00, 189.90, 3, '2024-01-01');

-- ============================================================================
-- STOCK (INVENTARIO)
-- ============================================================================

INSERT INTO stock (warehouse_id, product_id, quantity) VALUES
-- Tienda Mujeres
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440001', 15),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440002', 8),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440003', 12),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440004', 10),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440005', 6),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440006', 20),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440007', 15),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440008', 5),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440009', 18),
('TIENDA_MUJERES', 'a50e8400-e29b-41d4-a716-446655440010', 8),
-- Tienda Hombres
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440001', 10),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440002', 5),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440003', 8),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440004', 7),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440005', 4),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440006', 12),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440007', 10),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440008', 3),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440009', 12),
('TIENDA_HOMBRES', 'a50e8400-e29b-41d4-a716-446655440010', 6);

-- ============================================================================
-- CLIENTS (CLIENTES)
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
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE lines IS 'Seed data: 4 product lines';
COMMENT ON TABLE categories IS 'Seed data: 9 categories across all lines';
COMMENT ON TABLE brands IS 'Seed data: 5 popular fashion brands';
COMMENT ON TABLE sizes IS 'Seed data: 9 sizes for different categories';
COMMENT ON TABLE suppliers IS 'Seed data: 3 suppliers';
COMMENT ON TABLE products IS 'Seed data: 10 products across different categories';
COMMENT ON TABLE stock IS 'Seed data: Stock for 2 warehouses (TIENDA_MUJERES, TIENDA_HOMBRES)';
COMMENT ON TABLE clients IS 'Seed data: 8 clients with geolocation in Trujillo and districts';
