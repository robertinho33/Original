require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    console.log('Iniciando inclusao de dados de teste...');

    // 1. Categoria
    const catRes = await pool.query(`
      INSERT INTO categories (name, active)
      VALUES ('Tratamento', true)
      RETURNING id;
    `).catch(() => pool.query(`SELECT id FROM categories LIMIT 1;`));

    const categoryId = catRes.rows[0]?.id || null;

    // 2. Produtos
    await pool.query(`
      INSERT INTO products (name, sku, price, stock, active, category_id)
      VALUES 
        ('Shampoo Shine Express 1L', 'AUR-SH-01', 89.90, 15, true, $1),
        ('Mascara Reparadora 500g', 'AUR-MSK-02', 119.00, 4, true, $1),
        ('Acid Absolut Repair 300ml', 'VEHZKS3RJ', 145.00, 2, true, $1)
      ON CONFLICT DO NOTHING;
    `, [categoryId]);

    // 3. Cliente
    const custRes = await pool.query(`
      INSERT INTO customers (name, email, phone)
      VALUES ('Maria Silva', 'maria@email.com', '11999998888')
      RETURNING id;
    `).catch(() => pool.query(`SELECT id FROM customers LIMIT 1;`));

    const customerId = custRes.rows[0]?.id || null;

    // 4. Pedido
    await pool.query(`
      INSERT INTO orders (code, customer_id, total, status, created_at)
      VALUES ('AUR-MU5WX8P2', $1, 219.80, 'paid', NOW())
      ON CONFLICT DO NOTHING;
    `, [customerId]);

    console.log('✅ Dados de teste inseridos com sucesso!');
  } catch (err) {
    console.error('❌ Erro no Seed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
