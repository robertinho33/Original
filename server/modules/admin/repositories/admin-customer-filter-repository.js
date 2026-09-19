const { query } = require("./admin-db");

async function searchCustomers(term) {
    const value = `%${String(term || "").trim()}%`;

    const result = await query(`
        SELECT
            c.id,
            c.name,
            c.email,
            c.phone,
            c.created_at,
            COUNT(o.id) AS orders_count,
            COALESCE(SUM(o.total), 0) AS total_spent
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        WHERE
            c.name ILIKE $1
            OR c.email ILIKE $1
            OR c.phone ILIKE $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 200
    `, [value]);

    return result.rows;
}

module.exports = {
    searchCustomers
};
