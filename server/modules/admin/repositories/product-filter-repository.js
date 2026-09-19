const { query } = require("./admin-db");

async function searchProducts(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.search) {
        params.push(`%${String(filters.search).trim()}%`);

        conditions.push(`
            (
                p.name ILIKE $${params.length}
                OR p.sku ILIKE $${params.length}
            )
        `);
    }

    if (filters.category_id) {
        params.push(filters.category_id);
        conditions.push(`p.category_id = $${params.length}`);
    }

    if (filters.low_stock === "true") {
        conditions.push(`p.stock <= 5`);
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await query(
        `
        SELECT
            p.*,
            c.name AS category_name
        FROM products p
        LEFT JOIN categories c
            ON c.id = p.category_id
        ${where}
        ORDER BY p.name
        `,
        params
    );

    return result.rows;
}

module.exports = {
    searchProducts
};
