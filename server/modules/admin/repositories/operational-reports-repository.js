const { query } = require("./admin-db");

async function getOperationalReports() {
    const orders = await query(
        `
        SELECT
            DATE(created_at) AS day,
            COUNT(*) AS orders,
            COALESCE(SUM(total),0) AS revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day
        `
    );

    const products = await query(
        `
        SELECT
            p.id,
            p.sku,
            p.name,
            COUNT(oi.id) AS sold_units,
            COALESCE(SUM(oi.quantity),0) AS quantity
        FROM products p
        LEFT JOIN order_items oi
            ON oi.product_id = p.id
        GROUP BY p.id
        ORDER BY quantity DESC
        LIMIT 50
        `
    );

    return {
        dailySales: orders.rows,
        products: products.rows
    };
}

module.exports = {
    getOperationalReports
};
