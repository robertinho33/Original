-- ============================================================
-- AUREA COSMETICS
-- CONSOLIDAÇÃO DO BANCO ADMINISTRATIVO
-- PostgreSQL
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    role VARCHAR(40) NOT NULL DEFAULT 'admin',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    slug VARCHAR(140) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT products_price_nonnegative
        CHECK (price >= 0),

    CONSTRAINT products_stock_nonnegative
        CHECK (stock_quantity >= 0),

    CONSTRAINT products_reserved_nonnegative
        CHECK (reserved_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    email VARCHAR(180),
    phone VARCHAR(40),
    document VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL
        REFERENCES customers(id) ON DELETE CASCADE,

    cep VARCHAR(12),
    street VARCHAR(180),
    number VARCHAR(30),
    complement VARCHAR(120),
    neighborhood VARCHAR(120),
    city VARCHAR(120),
    state VARCHAR(80),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL,
    discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    minimum_order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(60) NOT NULL UNIQUE,

    customer_id BIGINT
        REFERENCES customers(id) ON DELETE SET NULL,

    status VARCHAR(40) NOT NULL DEFAULT 'created',
    payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(40),

    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    coupon_id BIGINT
        REFERENCES coupons(id) ON DELETE SET NULL,

    shipping_method VARCHAR(60),
    shipping_status VARCHAR(40) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    product_id BIGINT
        REFERENCES products(id) ON DELETE SET NULL,

    sku VARCHAR(80) NOT NULL,
    product_name VARCHAR(180) NOT NULL,

    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT order_items_quantity_positive
        CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL UNIQUE
        REFERENCES orders(id) ON DELETE CASCADE,

    method VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',

    amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    pix_txid VARCHAR(120),
    pix_copy_paste TEXT,
    pix_qr_code TEXT,

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL UNIQUE
        REFERENCES orders(id) ON DELETE CASCADE,

    method VARCHAR(60) NOT NULL,
    carrier VARCHAR(120),
    tracking_code VARCHAR(120),

    status VARCHAR(40) NOT NULL DEFAULT 'pending',

    estimated_delivery DATE,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,

    type VARCHAR(40) NOT NULL,
    quantity INTEGER NOT NULL,

    reference_type VARCHAR(60),
    reference_id VARCHAR(120),

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,

    order_id BIGINT
        REFERENCES orders(id) ON DELETE CASCADE,

    quantity INTEGER NOT NULL,

    status VARCHAR(40) NOT NULL DEFAULT 'reserved',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,

    CONSTRAINT inventory_reservations_quantity_positive
        CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES admin_users(id) ON DELETE SET NULL,

    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80),
    entity_id VARCHAR(120),

    result VARCHAR(40) NOT NULL DEFAULT 'success',

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_active
    ON products(active);

CREATE INDEX IF NOT EXISTS idx_orders_customer
    ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created
    ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);

CREATE INDEX IF NOT EXISTS idx_shipments_status
    ON shipments(status);

CREATE INDEX IF NOT EXISTS idx_inventory_product
    ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_reservations_product
    ON inventory_reservations(product_id);

CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_logs(entity_type, entity_id);


-- ============================================================
-- VIEWS OFICIAIS DO ADMIN
-- ============================================================

CREATE OR REPLACE VIEW admin_product_stock AS
SELECT
    p.id,
    p.sku,
    p.name,
    p.price,
    p.stock_quantity,
    p.reserved_quantity,
    GREATEST(
        p.stock_quantity - p.reserved_quantity,
        0
    ) AS available_quantity,
    p.minimum_stock,
    c.name AS category,
    p.active
FROM products p
LEFT JOIN categories c
    ON c.id = p.category_id;


CREATE OR REPLACE VIEW admin_order_summary AS
SELECT
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.payment_method,
    o.subtotal,
    o.shipping_amount,
    o.discount_amount,
    o.total_amount,
    o.shipping_method,
    o.shipping_status,
    o.created_at,
    o.updated_at,
    c.name AS customer_name,
    c.email AS customer_email
FROM orders o
LEFT JOIN customers c
    ON c.id = o.customer_id;


CREATE OR REPLACE VIEW admin_financial_summary AS
SELECT
    COUNT(*) AS total_orders,

    COALESCE(
        SUM(total_amount)
        FILTER (
            WHERE payment_status = 'paid'
        ),
        0
    ) AS paid_revenue,

    COALESCE(
        SUM(total_amount)
        FILTER (
            WHERE payment_status = 'pending'
        ),
        0
    ) AS pending_revenue,

    COALESCE(
        AVG(total_amount)
        FILTER (
            WHERE payment_status = 'paid'
        ),
        0
    ) AS average_ticket

FROM orders;


CREATE OR REPLACE VIEW admin_logistics_summary AS
SELECT
    COUNT(*) AS total_shipments,

    COUNT(*)
        FILTER (WHERE status = 'pending')
        AS pending_shipments,

    COUNT(*)
        FILTER (WHERE status = 'preparing')
        AS preparing_shipments,

    COUNT(*)
        FILTER (WHERE status = 'shipped')
        AS shipped_shipments,

    COUNT(*)
        FILTER (WHERE status = 'delivered')
        AS delivered_shipments

FROM shipments;


-- ============================================================
-- CUPONS
-- ============================================================

CREATE OR REPLACE VIEW admin_coupon_summary AS
SELECT
    c.id,
    c.code,
    c.type,
    c.discount_value,
    c.minimum_order_value,
    c.usage_limit,
    c.usage_count,
    c.starts_at,
    c.expires_at,
    c.active,

    CASE
        WHEN NOT c.active THEN 'inactive'
        WHEN c.expires_at IS NOT NULL
             AND c.expires_at < NOW()
            THEN 'expired'
        WHEN c.usage_limit IS NOT NULL
             AND c.usage_count >= c.usage_limit
            THEN 'exhausted'
        ELSE 'active'
    END AS computed_status

FROM coupons c;


-- ============================================================
-- AUDITORIA
-- ============================================================

CREATE OR REPLACE VIEW admin_audit_summary AS
SELECT
    a.id,
    a.created_at,
    COALESCE(u.name, 'Sistema') AS user_name,
    COALESCE(u.email, 'system') AS user_email,
    u.role,
    a.action,
    a.entity_type,
    a.entity_id,
    a.result,
    a.metadata
FROM audit_logs a
LEFT JOIN admin_users u
    ON u.id = a.user_id
ORDER BY a.created_at DESC;


-- ============================================================
-- ADMIN PADRÃO
-- ============================================================

INSERT INTO admin_users (
    name,
    email,
    role,
    active
)
VALUES (
    'Administrador AURÉA',
    'admin@aurea.com.br',
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION aurea_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_products_updated
ON products;

CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION aurea_set_updated_at();


DROP TRIGGER IF EXISTS trg_orders_updated
ON orders;

CREATE TRIGGER trg_orders_updated
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION aurea_set_updated_at();


DROP TRIGGER IF EXISTS trg_customers_updated
ON customers;

CREATE TRIGGER trg_customers_updated
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION aurea_set_updated_at();


DROP TRIGGER IF EXISTS trg_coupons_updated
ON coupons;

CREATE TRIGGER trg_coupons_updated
BEFORE UPDATE ON coupons
FOR EACH ROW
EXECUTE FUNCTION aurea_set_updated_at();


DROP TRIGGER IF EXISTS trg_payments_updated
ON payments;

CREATE TRIGGER trg_payments_updated
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION aurea_set_updated_at();


DROP TRIGGER IF EXISTS trg_shipments_updated
ON shipments;

CREATE TRIGGER trg_shipments_updated
BEFORE UPDATE ON shipments
FOR EACH ROW
EXECUTE FUNCTION aurea_set_updated_at();


-- ============================================================
-- FIM DA CONSOLIDAÇÃO
-- ============================================================
