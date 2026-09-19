const { query } = require("./admin-db");

async function getOrderHistory(orderId) {
    const result = await query(`
        SELECT *
        FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
    `, [orderId]);

    return result.rows;
}

async function getCustomerCommercialHistory(customerId) {
    const result = await query(`
        SELECT
            o.id,
            o.status,
            o.total,
            o.created_at,
            COUNT(oi.id) AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.customer_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `, [customerId]);

    return result.rows;
}

module.exports = {
    getOrderHistory,
    getCustomerCommercialHistory
};
