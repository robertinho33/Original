const { query } = require("./admin-db");

async function getDashboardReport() {
    const [sales, products, customers, orders] = await Promise.all([
        query(`
            SELECT
                DATE(created_at) AS day,
                COUNT(*) AS orders,
                COALESCE(SUM(total), 0) AS revenue
            FROM orders
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY day
        `),

        query(`
            SELECT
                p.id,
                p.sku,
                p.name,
                COALESCE(SUM(oi.quantity), 0) AS sold_quantity,
                COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
            FROM products p
            LEFT JOIN order_items oi ON oi.product_id = p.id
            GROUP BY p.id, p.sku, p.name
            ORDER BY sold_quantity DESC
            LIMIT 20
        `),

        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                ) AS new_last_30_days
            FROM customers
        `),

        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'paid') AS paid,
                COUNT(*) FILTER (WHERE status = 'processing') AS processing,
                COUNT(*) FILTER (WHERE status = 'shipped') AS shipped,
                COUNT(*) FILTER (WHERE status = 'delivered') AS delivered
            FROM orders
        `)
    ]);

    return {
        sales: sales.rows,
        products: products.rows,
        customers: customers.rows[0] || {},
        orders: orders.rows[0] || {}
    };
}

module.exports = {
    getDashboardReport
};
