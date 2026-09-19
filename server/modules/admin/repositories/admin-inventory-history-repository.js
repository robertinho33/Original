const { query } = require("./admin-db");

async function getInventoryHistory(productId = null) {
    const params = [];
    let filter = "";

    if (productId) {
        params.push(productId);
        filter = `WHERE im.product_id = $1`;
    }

    const result = await query(`
        SELECT
            im.id,
            im.product_id,
            p.sku,
            p.name,
            im.quantity,
            im.type,
            im.reason,
            im.created_at
        FROM inventory_movements im
        LEFT JOIN products p ON p.id = im.product_id
        ${filter}
        ORDER BY im.created_at DESC
        LIMIT 300
    `, params);

    return result.rows;
}

module.exports = {
    getInventoryHistory
};
