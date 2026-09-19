const { query } = require("./admin-db");

async function getInventoryOverview() {
    const result = await query(`
        SELECT
            COUNT(*) AS products,
            COALESCE(SUM(stock), 0) AS units,
            COUNT(*) FILTER (WHERE stock <= 0) AS out_of_stock,
            COUNT(*) FILTER (WHERE stock BETWEEN 1 AND 5) AS low_stock
        FROM products
    `);

    return result.rows[0];
}

async function getInventoryMovements(limit = 100) {
    const result = await query(`
        SELECT
            im.*,
            p.name AS product_name,
            p.sku
        FROM inventory_movements im
        LEFT JOIN products p ON p.id = im.product_id
        ORDER BY im.created_at DESC
        LIMIT $1
    `, [limit]);

    return result.rows;
}

async function getShippingQueue() {
    const result = await query(`
        SELECT
            s.*,
            o.id AS order_id,
            o.total
        FROM shipments s
        LEFT JOIN orders o ON o.id = s.order_id
        WHERE s.status IN ('pending','processing','ready_to_ship')
        ORDER BY s.created_at ASC
    `);

    return result.rows;
}

async function getFinancialOverview() {
    const result = await query(`
        SELECT
            COALESCE(SUM(total), 0) AS gross_revenue,
            COUNT(*) AS orders,
            COALESCE(AVG(total), 0) AS average_ticket
        FROM orders
        WHERE status NOT IN ('cancelled','canceled')
    `);

    return result.rows[0];
}

module.exports = {
    getInventoryOverview,
    getInventoryMovements,
    getShippingQueue,
    getFinancialOverview
};
