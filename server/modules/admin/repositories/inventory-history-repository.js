const { query } = require("./admin-db");

async function getInventoryHistory(limit = 200) {
    const result = await query(
        `
        SELECT
            m.*,
            p.name AS product_name,
            p.sku
        FROM inventory_movements m
        LEFT JOIN products p ON p.id = m.product_id
        ORDER BY m.created_at DESC
        LIMIT $1
        `,
        [Math.min(Number(limit) || 200, 500)]
    );

    return result.rows;
}

module.exports = {
    getInventoryHistory
};
