CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS role_id BIGINT
REFERENCES admin_roles(id);

INSERT INTO admin_roles
    (name, description, permissions)
VALUES
(
    'super_admin',
    'Acesso administrativo completo',
    '{
        "dashboard": true,
        "orders": true,
        "products": true,
        "categories": true,
        "inventory": true,
        "customers": true,
        "finance": true,
        "coupons": true,
        "logistics": true,
        "reports": true,
        "audit": true,
        "settings": true
    }'::jsonb
),
(
    'operator',
    'Operação de pedidos e estoque',
    '{
        "dashboard": true,
        "orders": true,
        "products": false,
        "categories": false,
        "inventory": true,
        "customers": true,
        "finance": false,
        "coupons": false,
        "logistics": true,
        "reports": true,
        "audit": false,
        "settings": false
    }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

UPDATE admin_users
SET role_id = (
    SELECT id
    FROM admin_roles
    WHERE name = 'super_admin'
)
WHERE role_id IS NULL;
