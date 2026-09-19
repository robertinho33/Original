const { query } = require("./admin-db");

async function getReservations() {
    const result = await query(
        `
        SELECT
            r.*,
            p.name AS product_name,
            p.sku
        FROM inventory_reservations r
        LEFT JOIN products p ON p.id = r.product_id
        ORDER BY r.created_at DESC
        `
    );

    return result.rows;
}

module.exports = {
    getReservations
};
