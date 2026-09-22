-- =====================================================
-- Store Management System — Schema
-- MySQL 8.x / MariaDB 10.4+
-- =====================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at   DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE currencies (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            CHAR(3) NOT NULL,
  name            VARCHAR(50) NOT NULL,
  symbol          VARCHAR(10) NOT NULL,
  decimal_places  TINYINT UNSIGNED NOT NULL DEFAULT 2,
  is_base         TINYINT(1) NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_currencies_code (code),
  KEY idx_currencies_base (is_base)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exchange_rates (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  currency_id       BIGINT UNSIGNED NOT NULL,
  base_currency_id  BIGINT UNSIGNED NOT NULL,
  rate_to_base      DECIMAL(18,8) NOT NULL,
  effective_at      DATETIME NOT NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_by        BIGINT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exchange_rates (currency_id, base_currency_id, effective_at),
  KEY idx_exchange_lookup (currency_id, base_currency_id, effective_at DESC),
  CONSTRAINT fk_er_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_er_base FOREIGN KEY (base_currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_er_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100) NOT NULL,
  description  TEXT NULL,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suppliers (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) NULL,
  phone          VARCHAR(30) NULL,
  email          VARCHAR(150) NULL,
  address        TEXT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suppliers_name (name),
  KEY idx_suppliers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customers (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150) NOT NULL,
  phone       VARCHAR(30) NULL,
  email       VARCHAR(150) NULL,
  address     TEXT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customers_name (name),
  KEY idx_customers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE settings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key`       VARCHAR(100) NOT NULL,
  value       TEXT NULL,
  `type`      ENUM('string','int','bool','json') NOT NULL DEFAULT 'string',
  `group`     VARCHAR(50) NOT NULL DEFAULT 'general',
  updated_by  BIGINT UNSIGNED NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (`key`),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_methods (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(30) NOT NULL,
  name       VARCHAR(50) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  is_system  TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_methods_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE digital_wallet_providers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id    BIGINT UNSIGNED NULL,
  name           VARCHAR(150) NOT NULL,
  sku            VARCHAR(60) NOT NULL,
  barcode        VARCHAR(60) NULL,
  description    TEXT NULL,
  unit           VARCHAR(20) NOT NULL DEFAULT 'pcs',
  cost_price     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  selling_price  DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  stock_qty      DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  reorder_level  DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  image_path     VARCHAR(255) NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by     BIGINT UNSIGNED NULL,
  updated_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  UNIQUE KEY uq_products_barcode (barcode),
  KEY idx_products_category (category_id),
  KEY idx_products_name (name),
  KEY idx_products_stock (stock_qty, reorder_level),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movements (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id      BIGINT UNSIGNED NOT NULL,
  type            ENUM('purchase','sale','return','adjustment','void','correction') NOT NULL,
  quantity        DECIMAL(14,3) NOT NULL,
  reference_type  VARCHAR(40) NULL,
  reference_id    BIGINT UNSIGNED NULL,
  unit_cost_base  DECIMAL(14,2) NULL,
  user_id         BIGINT UNSIGNED NULL,
  note            VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sm_product_date (product_id, created_at),
  KEY idx_sm_reference (reference_type, reference_id),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_sm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchases (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no             VARCHAR(30) NOT NULL,
  supplier_id            BIGINT UNSIGNED NOT NULL,
  user_id                BIGINT UNSIGNED NOT NULL,
  currency_id            BIGINT UNSIGNED NOT NULL,
  base_currency_id       BIGINT UNSIGNED NOT NULL,
  exchange_rate_to_base  DECIMAL(18,8) NOT NULL,
  purchase_date          DATE NOT NULL,
  subtotal               DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  discount_type          ENUM('fixed','percent') NULL,
  discount_value         DECIMAL(14,2) NULL,
  discount_amount        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_rate               DECIMAL(6,3) NULL,
  tax_amount             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  total                  DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  subtotal_base          DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  discount_amount_base   DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_amount_base        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  total_base             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  paid_amount            DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  due_amount             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  payment_status         ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  status                 ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'completed',
  notes                  TEXT NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchases_invoice (invoice_no),
  KEY idx_purchases_supplier (supplier_id),
  KEY idx_purchases_date (purchase_date),
  KEY idx_purchases_status (status),
  KEY idx_purchases_currency (currency_id),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_purchases_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_purchases_base_currency FOREIGN KEY (base_currency_id) REFERENCES currencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_items (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id     BIGINT UNSIGNED NOT NULL,
  product_id      BIGINT UNSIGNED NOT NULL,
  quantity        DECIMAL(14,3) NOT NULL,
  unit_cost       DECIMAL(14,2) NOT NULL,
  unit_cost_base  DECIMAL(14,2) NOT NULL,
  discount_amount DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_amount      DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  line_total      DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  line_total_base DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_pi_purchase (purchase_id),
  KEY idx_pi_product (product_id),
  CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sales (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no             VARCHAR(30) NOT NULL,
  customer_id            BIGINT UNSIGNED NULL,
  user_id                BIGINT UNSIGNED NOT NULL,
  currency_id            BIGINT UNSIGNED NOT NULL,
  base_currency_id       BIGINT UNSIGNED NOT NULL,
  exchange_rate_to_base  DECIMAL(18,8) NOT NULL,
  sale_date              DATE NOT NULL,
  subtotal               DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  discount_type          ENUM('fixed','percent') NULL,
  discount_value         DECIMAL(14,2) NULL,
  discount_amount        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_rate               DECIMAL(6,3) NULL,
  tax_amount             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  total                  DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  subtotal_base          DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  discount_amount_base   DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_amount_base        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  total_base             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  cogs_base              DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  profit_base            DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  paid_amount            DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  due_amount             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  payment_status         ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  status                 ENUM('completed','void_requested','voided','return_requested','partially_returned','returned') NOT NULL DEFAULT 'completed',
  notes                  TEXT NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sales_invoice (invoice_no),
  KEY idx_sales_customer (customer_id),
  KEY idx_sales_date (sale_date),
  KEY idx_sales_status (status),
  KEY idx_sales_currency (currency_id),
  KEY idx_sales_user (user_id),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_sales_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_sales_base_currency FOREIGN KEY (base_currency_id) REFERENCES currencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sale_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id           BIGINT UNSIGNED NOT NULL,
  product_id        BIGINT UNSIGNED NOT NULL,
  quantity          DECIMAL(14,3) NOT NULL,
  returned_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  unit_price        DECIMAL(14,2) NOT NULL,
  unit_price_base   DECIMAL(14,2) NOT NULL,
  discount_amount   DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_amount        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  line_total        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  line_total_base   DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  cogs_base         DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_si_sale (sale_id),
  KEY idx_si_product (product_id),
  CONSTRAINT fk_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id                               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payable_type                     ENUM('sale','purchase') NOT NULL,
  payable_id                       BIGINT UNSIGNED NOT NULL,
  currency_id                      BIGINT UNSIGNED NOT NULL,
  amount                           DECIMAL(16,2) NOT NULL,
  exchange_rate_to_base            DECIMAL(18,8) NOT NULL,
  amount_in_transaction_currency   DECIMAL(16,2) NOT NULL,
  amount_base                      DECIMAL(16,2) NOT NULL,
  payment_method_id                BIGINT UNSIGNED NOT NULL,
  wallet_provider_id               BIGINT UNSIGNED NULL,
  reference_no                     VARCHAR(100) NULL,
  payment_date                     DATETIME NOT NULL,
  user_id                          BIGINT UNSIGNED NOT NULL,
  note                             VARCHAR(255) NULL,
  created_at                       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_payable (payable_type, payable_id),
  KEY idx_payments_date (payment_date),
  KEY idx_payments_method (payment_method_id),
  CONSTRAINT fk_payments_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_payments_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  CONSTRAINT fk_payments_wallet FOREIGN KEY (wallet_provider_id) REFERENCES digital_wallet_providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE return_requests (
  id                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id                   BIGINT UNSIGNED NOT NULL,
  customer_id               BIGINT UNSIGNED NULL,
  requested_by              BIGINT UNSIGNED NOT NULL,
  approved_by               BIGINT UNSIGNED NULL,
  currency_id               BIGINT UNSIGNED NOT NULL,
  base_currency_id          BIGINT UNSIGNED NOT NULL,
  exchange_rate_to_base     DECIMAL(18,8) NOT NULL,
  reason                    VARCHAR(255) NOT NULL,
  notes                     TEXT NULL,
  subtotal                  DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  tax_amount                DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  total                     DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  total_base                DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  refund_method             ENUM('cash','original_method','store_credit','other') NOT NULL DEFAULT 'original_method',
  refund_currency_id        BIGINT UNSIGNED NULL,
  refund_exchange_rate_base DECIMAL(18,8) NULL,
  refund_amount             DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  refund_amount_base        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  status                    ENUM('pending','approved','rejected','completed','cancelled') NOT NULL DEFAULT 'pending',
  decision_note             VARCHAR(255) NULL,
  requested_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at                DATETIME NULL,
  completed_at              DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_rr_sale (sale_id),
  KEY idx_rr_status (status),
  KEY idx_rr_requested_by (requested_by),
  KEY idx_rr_approved_by (approved_by),
  CONSTRAINT fk_rr_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_rr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_rr_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_rr_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_rr_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_rr_base_currency FOREIGN KEY (base_currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_rr_refund_currency FOREIGN KEY (refund_currency_id) REFERENCES currencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE return_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_request_id  BIGINT UNSIGNED NOT NULL,
  sale_item_id       BIGINT UNSIGNED NOT NULL,
  product_id         BIGINT UNSIGNED NOT NULL,
  quantity           DECIMAL(14,3) NOT NULL,
  unit_price         DECIMAL(14,2) NOT NULL,
  line_total         DECIMAL(16,2) NOT NULL,
  line_total_base    DECIMAL(16,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_ri_return (return_request_id),
  KEY idx_ri_sale_item (sale_item_id),
  KEY idx_ri_product (product_id),
  CONSTRAINT fk_ri_return FOREIGN KEY (return_request_id) REFERENCES return_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ri_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  CONSTRAINT fk_ri_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE void_requests (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id        BIGINT UNSIGNED NOT NULL,
  requested_by   BIGINT UNSIGNED NOT NULL,
  approved_by    BIGINT UNSIGNED NULL,
  reason         VARCHAR(255) NOT NULL,
  status         ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  decision_note  VARCHAR(255) NULL,
  requested_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at     DATETIME NULL,
  completed_at   DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_vr_sale (sale_id),
  KEY idx_vr_status (status),
  CONSTRAINT fk_vr_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_vr_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_vr_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NULL,
  action       VARCHAR(60) NOT NULL,
  entity_type  VARCHAR(40) NULL,
  entity_id    BIGINT UNSIGNED NULL,
  before_json  JSON NULL,
  after_json   JSON NULL,
  ip_address   VARCHAR(45) NULL,
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_action (action),
  KEY idx_audit_date (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_sequences (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prefix       VARCHAR(10) NOT NULL,
  year         SMALLINT UNSIGNED NOT NULL,
  last_number  INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_sequences (prefix, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;