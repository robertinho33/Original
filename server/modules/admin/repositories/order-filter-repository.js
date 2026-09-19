const { query } = require("./admin-db");

async function searchOrders(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.status) {
        params.push(filters.status);
        conditions.push(`o.status = $${params.length}`);
    }

    if (filters.search) {
        params.push(`%${String(filters.search).trim()}%`);
        conditions.push(`
            (
                o.order_number ILIKE $${params.length}
                OR c.name ILIKE $${params.length}
                OR c.email ILIKE $${params.length}
            )
        `);
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    params.push(Math.min(Number(filters.limit) || 100, 500));

    const result = await query(
        `
        SELECT
            o.id,
            o.order_number,
            o.status,
            o.total,
            o.created_at,
            c.name AS customer_name,
            c.email AS customer_email
        FROM orders o
        LEFT JOIN customers c
            ON c.id = o.customer_id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT $${params.length}
        `,
        params
    );

    return result.rows;
}

module.exports = {
    searchOrders
};
