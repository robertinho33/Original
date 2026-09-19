const { query } = require("./admin-db");

async function getProductPerformance() {
    const result = await query(`
        SELECT
            p.id,
            p.sku,
            p.name,
            p.stock,
            COUNT(oi.id) AS order_lines,
            COALESCE(SUM(oi.quantity),0) AS units_sold,
            COALESCE(
                SUM(oi.quantity * oi.unit_price),
                0
            ) AS gross_revenue
        FROM products p
        LEFT JOIN order_items oi
            ON oi.product_id = p.id
        GROUP BY p.id
        ORDER BY units_sold DESC
    `);

    return result.rows;
}

module.exports = {
    getProductPerformance
};
