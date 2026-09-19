const { query } = require("./admin-db");

async function salesReport() {
    const result = await query(`
        SELECT
            DATE(created_at) AS day,
            COUNT(*) AS orders,
            COALESCE(SUM(total), 0) AS revenue,
            COALESCE(AVG(total), 0) AS average_ticket
        FROM orders
        WHERE status NOT IN ('cancelled','canceled')
        GROUP BY DATE(created_at)
        ORDER BY day DESC
        LIMIT 365
    `);

    return result.rows;
}

async function productReport() {
    const result = await query(`
        SELECT
            p.id,
            p.name,
            p.sku,
            COALESCE(SUM(oi.quantity), 0) AS units_sold,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        GROUP BY p.id
        ORDER BY revenue DESC
    `);

    return result.rows;
}

async function customerReport() {
    const result = await query(`
        SELECT
            c.id,
            c.name,
            c.email,
            COUNT(o.id) AS orders,
            COALESCE(SUM(o.total), 0) AS lifetime_value
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id
        ORDER BY lifetime_value DESC
    `);

    return result.rows;
}

async function auditReport(limit = 200) {
    const result = await query(`
        SELECT *
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1
    `, [limit]);

    return result.rows;
}

async function globalSearch(term) {
    const value = `%${term}%`;

    const [products, customers, orders] = await Promise.all([
        query(`
            SELECT id, name, sku
            FROM products
            WHERE name ILIKE $1 OR sku ILIKE $1
            ORDER BY name
            LIMIT 20
        `, [value]),

        query(`
            SELECT id, name, email
            FROM customers
            WHERE name ILIKE $1 OR email ILIKE $1
            ORDER BY name
            LIMIT 20
        `, [value]),

        query(`
            SELECT id, status, total, created_at
            FROM orders
            WHERE CAST(id AS TEXT) ILIKE $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [value])
    ]);

    return {
        products: products.rows,
        customers: customers.rows,
        orders: orders.rows
    };
}

module.exports = {
    salesReport,
    productReport,
    customerReport,
    auditReport,
    globalSearch
};
