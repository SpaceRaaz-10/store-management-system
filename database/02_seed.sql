-- =====================================================
-- Store Management System — Seed data
-- =====================================================
SET NAMES utf8mb4;

INSERT INTO currencies (code, name, symbol, decimal_places, is_base, is_active) VALUES
  ('NPR', 'Nepalese Rupee', 'रु', 2, 1, 1),
  ('USD', 'US Dollar',      '$',  2, 0, 1),
  ('INR', 'Indian Rupee',   '₹',  2, 0, 1);

INSERT INTO payment_methods (code, name, is_system) VALUES
  ('cash',           'Cash',          1),
  ('card',           'Card',          1),
  ('bank_transfer',  'Bank Transfer', 1),
  ('digital_wallet', 'Digital Wallet',1),
  ('other',          'Other',         1);

-- Default admin — email: admin@store.local / password: Admin@123
INSERT INTO users (name, email, password_hash, role, status) VALUES
  ('System Admin', 'admin@store.local',
   '$2y$10$e0NR2g/vI1oFfUpm1c6Xqu1jLcJlO1hAe6yqfFqLmH6P7uVtH0oYu',
   'admin', 'active');

-- Baseline exchange rates (1 USD = 140 NPR, 1 INR = 1.60 NPR)
INSERT INTO exchange_rates (currency_id, base_currency_id, rate_to_base, effective_at, created_by)
SELECT c.id, b.id, 140.00000000, NOW(), u.id
FROM currencies c, currencies b, users u
WHERE c.code = 'USD' AND b.code = 'NPR' AND u.email = 'admin@store.local';

INSERT INTO exchange_rates (currency_id, base_currency_id, rate_to_base, effective_at, created_by)
SELECT c.id, b.id, 1.60000000, NOW(), u.id
FROM currencies c, currencies b, users u
WHERE c.code = 'INR' AND b.code = 'NPR' AND u.email = 'admin@store.local';

INSERT INTO settings (`key`, value, `type`, `group`) VALUES
  ('store.name',        'My Store',       'string', 'general'),
  ('store.address',     '',               'string', 'general'),
  ('store.phone',       '',               'string', 'general'),
  ('store.email',       '',               'string', 'general'),
  ('invoice.prefix',    'INV',            'string', 'billing'),
  ('purchase.prefix',   'PUR',            'string', 'billing'),
  ('invoice.tax_rate',  '13',             'string', 'billing'),
  ('default.currency',  'NPR',            'string', 'billing'),
  ('base.currency',     'NPR',            'string', 'billing');