const { query } = require("./admin-db");

async function searchProducts(filters = {}) {
    const params = [];
    const where = [];

    if (filters.term) {
        params.push(`%${filters.term}%`);
        where.push(`(
            p.name ILIKE $${params.length}
            OR p.sku ILIKE $${params.length}
        )`);
    }

    if (filters.category) {
        params.push(filters.category);
        where.push(`p.category_id = $${params.length}`);
    }

    if (filters.active !== undefined) {
        params.push(filters.active === "true");
        where.push(`p.active = $${params.length}`);
    }

    if (filters.lowStock === "true") {
        where.push(`p.stock <= 5`);
    }

    const result = await query(`
        SELECT
            p.id,
            p.sku,
            p.name,
            p.price,
            p.stock,
            p.active,
            c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY p.name
        LIMIT 300
    `, params);

    return result.rows;
}

module.exports = {
    searchProducts
};
