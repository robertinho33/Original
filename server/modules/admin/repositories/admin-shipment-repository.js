const { query } = require("./admin-db");

async function getShipmentDetails(id) {
    const result = await query(`
        SELECT
            s.*,
            o.customer_id,
            o.total,
            c.name AS customer_name
        FROM shipments s
        LEFT JOIN orders o ON o.id = s.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE s.id = $1
        LIMIT 1
    `, [id]);

    return result.rows[0] || null;
}

async function listShipments() {
    const result = await query(`
        SELECT
            s.*,
            o.total,
            c.name AS customer_name
        FROM shipments s
        LEFT JOIN orders o ON o.id = s.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY s.created_at DESC
    `);

    return result.rows;
}

module.exports = {
    getShipmentDetails,
    listShipments
};
