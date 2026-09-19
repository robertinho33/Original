const { query } = require("./admin-db");

async function getLogisticsDetails() {
    const shipments = await query(
        `
        SELECT
            s.*,
            o.order_number,
            o.customer_id
        FROM shipments s
        LEFT JOIN orders o ON o.id = s.order_id
        ORDER BY s.created_at DESC
        LIMIT 200
        `
    );

    const pending = await query(
        `
        SELECT COUNT(*) AS total
        FROM shipments
        WHERE status IN ('pending','processing','ready')
        `
    );

    return {
        shipments: shipments.rows,
        pending: Number(pending.rows[0]?.total || 0)
    };
}

module.exports = {
    getLogisticsDetails
};
