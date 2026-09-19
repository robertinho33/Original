BEGIN;

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT,
    phone TEXT,
    cpf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    description TEXT,
    category_id BIGINT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category_id BIGINT;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS image TEXT;

-- ============================================================
-- PEDIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_number TEXT UNIQUE,
    customer_id BIGINT,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS customer_id BIGINT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_number TEXT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- ITENS DOS PEDIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT,
    sku TEXT,
    product_name TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS product_id BIGINT;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS product_name TEXT;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) DEFAULT 0;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- PAGAMENTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    method TEXT,
    status TEXT DEFAULT 'pending',
    amount NUMERIC(12,2) DEFAULT 0,
    transaction_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS order_id BIGINT;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS method TEXT;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- ============================================================
-- CUPONS
-- ============================================================

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC(12,2) DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- ============================================================
-- ENVIO
-- ============================================================

CREATE TABLE IF NOT EXISTS shipments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    carrier TEXT,
    service TEXT,
    tracking_code TEXT,
    status TEXT DEFAULT 'pending',
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS order_id BIGINT;

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier TEXT;

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS service TEXT;

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS tracking_code TEXT;

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- ============================================================
-- ESTOQUE
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT,
    type TEXT NOT NULL DEFAULT 'adjustment',
    quantity INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT,
    order_id BIGINT,
    quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'reserved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ENDEREÇOS
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_addresses (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDITORIA
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_entity_history (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changed_by BIGINT,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    previous_status TEXT,
    new_status TEXT,
    changed_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMINISTRAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role_id BIGINT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT,
    module TEXT NOT NULL,
    operation TEXT NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(role_id, module, operation)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_notifications (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT,
    type TEXT,
    title TEXT,
    message TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DADOS ADMINISTRATIVOS PADRÃO
-- ============================================================

INSERT INTO admin_roles (name, description)
VALUES
    ('super_admin', 'Acesso administrativo completo'),
    ('operator', 'Operação administrativa')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_users (name, email, role_id)
SELECT
    'Administrador',
    'admin@aurea.com.br',
    id
FROM admin_roles
WHERE name = 'super_admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin_settings (key, value)
VALUES
    ('store_name', '"AUREA COSMETICS"'),
    ('currency', '"BRL"'),
    ('low_stock_limit', '5'),
    ('orders_page_size', '25'),
    ('admin_timezone', '"America/Sao_Paulo"')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
    ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_sku
    ON products(sku);

CREATE INDEX IF NOT EXISTS idx_inventory_product
    ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_shipments_order
    ON shipments(order_id);

-- ============================================================
-- VIEW DO ESTOQUE
-- ============================================================

DROP VIEW IF EXISTS admin_product_stock;

CREATE VIEW admin_product_stock AS
SELECT
    p.id,
    p.sku,
    p.name,
    COALESCE(p.stock, 0) AS stock,
    COALESCE(p.active, TRUE) AS active,
    c.name AS category_name
FROM products p
LEFT JOIN categories c
    ON c.id = p.category_id;

-- ============================================================
-- VIEW DOS PEDIDOS
-- ============================================================

DROP VIEW IF EXISTS admin_order_summary;

CREATE VIEW admin_order_summary AS
SELECT
    o.id,
    o.order_number,
    o.customer_id,
    o.status,
    o.payment_status,
    COALESCE(NULLIF(o.total_amount, 0), o.total, 0) AS total_amount,
    o.created_at
FROM orders o;

-- ============================================================
-- VIEW FINANCEIRA
-- ============================================================

DROP VIEW IF EXISTS admin_financial_summary;

CREATE VIEW admin_financial_summary AS
SELECT
    COUNT(*) AS orders_count,
    COALESCE(SUM(
        COALESCE(NULLIF(total_amount, 0), total, 0)
    ), 0) AS gross_revenue
FROM orders;

COMMIT;