const { query } = require("./admin-db");

async function search(term) {
    const value = `%${String(term || "").trim()}%`;

    if (String(term || "").trim().length < 2) {
        return [];
    }

    const result = await query(
        `
        SELECT *
        FROM (
            SELECT
                'product' AS type,
                id::text AS id,
                name AS title,
                sku AS reference
            FROM products
            WHERE name ILIKE $1
               OR sku ILIKE $1

            UNION ALL

            SELECT
                'customer' AS type,
                id::text AS id,
                name AS title,
                email AS reference
            FROM customers
            WHERE name ILIKE $1
               OR email ILIKE $1

            UNION ALL

            SELECT
                'order' AS type,
                id::text AS id,
                order_number AS title,
                status AS reference
            FROM orders
            WHERE order_number ILIKE $1
        ) results
        ORDER BY title
        LIMIT 50
        `,
        [value]
    );

    return result.rows;
}

module.exports = {
    search
};
