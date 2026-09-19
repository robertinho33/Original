const { query } = require("./admin-db");

async function getTracking(orderId) {
    const result = await query(
        `
        SELECT
            s.*,
            o.order_number
        FROM shipments s
        JOIN orders o
            ON o.id = s.order_id
        WHERE s.order_id = $1
        ORDER BY s.created_at DESC
        `,
        [orderId]
    );

    return result.rows;
}

module.exports = {
    getTracking
};
