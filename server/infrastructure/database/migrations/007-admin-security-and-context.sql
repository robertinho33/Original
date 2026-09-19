CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    module TEXT NOT NULL,
    operation TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module, operation)
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT 'Administrador',
    role_id BIGINT REFERENCES admin_roles(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_entity_history (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT REFERENCES admin_users(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_notifications (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token
ON admin_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiration
ON admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin
ON admin_notifications(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_history_entity
ON admin_entity_history(entity_type, entity_id, created_at DESC);

INSERT INTO admin_roles(name, description)
VALUES
    ('super_admin', 'Acesso completo ao painel administrativo'),
    ('operator', 'Operação diária do comércio')
ON CONFLICT(name) DO NOTHING;

INSERT INTO admin_permissions(module, operation, description)
VALUES
    ('dashboard','view','Visualizar dashboard'),
    ('orders','view','Visualizar pedidos'),
    ('orders','create','Criar pedidos'),
    ('orders','update','Atualizar pedidos'),
    ('orders','delete','Excluir pedidos'),
    ('products','view','Visualizar produtos'),
    ('products','create','Criar produtos'),
    ('products','update','Atualizar produtos'),
    ('products','delete','Excluir produtos'),
    ('categories','view','Visualizar categorias'),
    ('categories','create','Criar categorias'),
    ('categories','update','Atualizar categorias'),
    ('categories','delete','Excluir categorias'),
    ('inventory','view','Visualizar estoque'),
    ('inventory','update','Movimentar estoque'),
    ('customers','view','Visualizar clientes'),
    ('customers','update','Atualizar clientes'),
    ('finance','view','Visualizar financeiro'),
    ('coupons','view','Visualizar cupons'),
    ('coupons','create','Criar cupons'),
    ('coupons','update','Atualizar cupons'),
    ('logistics','view','Visualizar logística'),
    ('logistics','update','Atualizar logística'),
    ('reports','view','Visualizar relatórios'),
    ('audit','view','Visualizar auditoria'),
    ('settings','view','Visualizar configurações'),
    ('settings','update','Atualizar configurações'),
    ('admin_users','view','Visualizar administradores'),
    ('admin_users','update','Administrar usuários'),
    ('permissions','view','Visualizar permissões'),
    ('permissions','update','Alterar permissões')
ON CONFLICT(module, operation) DO NOTHING;

UPDATE admin_users
SET role_id = (
    SELECT id
    FROM admin_roles
    WHERE name = 'super_admin'
)
WHERE role_id IS NULL;

INSERT INTO admin_users(email, name, role_id)
SELECT
    'admin@aurea.com.br',
    'Administrador AUREA',
    id
FROM admin_roles
WHERE name = 'super_admin'
  AND NOT EXISTS (
      SELECT 1
      FROM admin_users
      WHERE email = 'admin@aurea.com.br'
  );

INSERT INTO admin_role_permissions(role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions(role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin_roles r
JOIN admin_permissions p
  ON (
      p.module IN (
          'dashboard',
          'orders',
          'products',
          'categories',
          'inventory',
          'customers',
          'logistics'
      )
      AND p.operation IN ('view','update')
  )
WHERE r.name = 'operator'
ON CONFLICT DO NOTHING;
