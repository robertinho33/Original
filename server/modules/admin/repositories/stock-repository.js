const { query } = require("./admin-db");

async function getStockDetails(productId) {
    const product = await query(
        `
        SELECT
            p.id,
            p.sku,
            p.name,
            p.stock,
            p.active,
            c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = $1
        `,
        [productId]
    );

    const movements = await query(
        `
        SELECT *
        FROM inventory_movements
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [productId]
    );

    const reservations = await query(
        `
        SELECT *
        FROM inventory_reservations
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [productId]
    );

    return {
        product: product.rows[0] || null,
        movements: movements.rows,
        reservations: reservations.rows
    };
}

module.exports = {
    getStockDetails
};
