const { query } =
    require("../repositories/admin-db");

async function getSalesReport() {

    const result = await query(`
        SELECT
            DATE(created_at) AS day,
            COUNT(*)::INTEGER AS orders,
            COALESCE(
                SUM(total),
                0
            ) AS revenue
        FROM orders
        GROUP BY DATE(created_at)
        ORDER BY day DESC
        LIMIT 90
    `);

    return result.rows;
}

async function getProductReport() {

    const result = await query(`
        SELECT
            p.id,
            p.name,
            p.sku,
            p.price,
            p.stock,
            COUNT(oi.id)::INTEGER AS units_sold
        FROM products p
        LEFT JOIN order_items oi
            ON oi.product_id = p.id
        GROUP BY
            p.id,
            p.name,
            p.sku,
            p.price,
            p.stock
        ORDER BY
            units_sold DESC,
            p.name
    `);

    return result.rows;
}

async function getCustomerReport() {

    const result = await query(`
        SELECT
            c.id,
            c.name,
            c.email,
            COUNT(o.id)::INTEGER AS orders_count,
            COALESCE(
                SUM(o.total),
                0
            ) AS total_spent
        FROM customers c
        LEFT JOIN orders o
            ON o.customer_id = c.id
        GROUP BY
            c.id,
            c.name,
            c.email
        ORDER BY
            total_spent DESC
    `);

    return result.rows;
}

module.exports = {
    getSalesReport,
    getProductReport,
    getCustomerReport
};
