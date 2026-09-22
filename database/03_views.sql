-- =====================================================
-- Store Management System — Reporting views
-- =====================================================

CREATE OR REPLACE VIEW v_sales_with_currency AS
SELECT s.*, c.code AS currency_code, c.symbol AS currency_symbol,
       b.code AS base_code, b.symbol AS base_symbol
FROM sales s
JOIN currencies c ON c.id = s.currency_id
JOIN currencies b ON b.id = s.base_currency_id;

CREATE OR REPLACE VIEW v_products_low_stock AS
SELECT p.*, c.name AS category_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.status = 'active' AND p.stock_qty <= p.reorder_level;