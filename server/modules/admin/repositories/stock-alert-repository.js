const { query } = require("./admin-db");

async function getStockAlerts(limit = 5) {
    const result = await query(
        `
        SELECT
            id,
            sku,
            name,
            stock,
            active
        FROM products
        WHERE active = TRUE
          AND stock <= $1
        ORDER BY stock ASC, name
        `,
        [Number(limit)]
    );

    return result.rows;
}

module.exports = {
    getStockAlerts
};
