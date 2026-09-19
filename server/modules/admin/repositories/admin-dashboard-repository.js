const { query } = require("./admin-db");

async function getOperationalSummary() {
    const result = await query(`
        SELECT
            (SELECT COUNT(*) FROM orders
                WHERE status IN ('pending','processing')) AS pending_orders,

            (SELECT COUNT(*) FROM orders
                WHERE status = 'paid') AS paid_orders,

            (SELECT COUNT(*) FROM products
                WHERE stock <= 5 AND active = TRUE) AS critical_stock,

            (SELECT COUNT(*) FROM shipments
                WHERE status IN ('pending','processing','ready')) AS shipments_pending,

            (SELECT COUNT(*) FROM inventory_reservations
                WHERE status = 'active') AS active_reservations,

            (SELECT COUNT(*) FROM coupons
                WHERE active = TRUE) AS active_coupons,

            (SELECT COUNT(*) FROM customers) AS customers,

            (SELECT COALESCE(SUM(total),0)
                FROM orders
                WHERE status = 'paid'
                AND created_at >= CURRENT_DATE) AS today_revenue
    `);

    return result.rows[0];
}

async function getRecentOrders(limit = 10) {
    const result = await query(
        `
        SELECT
            o.id,
            o.order_number,
            o.status,
            o.total,
            o.created_at,
            c.name AS customer_name
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY o.created_at DESC
        LIMIT $1
        `,
        [Math.min(Number(limit) || 10, 50)]
    );

    return result.rows;
}

module.exports = {
    getOperationalSummary,
    getRecentOrders
};
