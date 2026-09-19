const { query } = require("./admin-db");

async function getOrderDetails(id) {
    const order = await query(
        `
        SELECT *
        FROM orders
        WHERE id = $1
        `,
        [id]
    );

    if (!order.rows[0]) {
        return null;
    }

    const items = await query(
        `
        SELECT
            oi.*,
            p.name AS product_name,
            p.sku
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1
        ORDER BY oi.id
        `,
        [id]
    );

    const payments = await query(
        `
        SELECT *
        FROM payments
        WHERE order_id = $1
        ORDER BY created_at DESC
        `,
        [id]
    );

    const shipment = await query(
        `
        SELECT *
        FROM shipments
        WHERE order_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [id]
    );

    return {
        order: order.rows[0],
        items: items.rows,
        payments: payments.rows,
        shipment: shipment.rows[0] || null
    };
}

module.exports = {
    getOrderDetails
};
