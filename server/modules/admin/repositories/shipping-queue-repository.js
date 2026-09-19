const { query } = require("./admin-db");

async function getShippingQueue() {
    const result = await query(`
        SELECT
            s.id,
            s.order_id,
            s.status,
            s.tracking_code,
            o.order_number,
            o.created_at
        FROM shipments s
        JOIN orders o
            ON o.id = s.order_id
        WHERE s.status IN (
            'pending',
            'processing',
            'ready'
        )
        ORDER BY o.created_at ASC
    `);

    return result.rows;
}

module.exports = {
    getShippingQueue
};
