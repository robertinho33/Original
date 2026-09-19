const { query } = require("./admin-db");

async function searchOrders(filters = {}) {
    const params = [];
    const where = [];

    if (filters.status) {
        params.push(filters.status);
        where.push(`o.status = $${params.length}`);
    }

    if (filters.customer) {
        params.push(`%${filters.customer}%`);
        where.push(`c.name ILIKE $${params.length}`);
    }

    if (filters.from) {
        params.push(filters.from);
        where.push(`o.created_at >= $${params.length}`);
    }

    if (filters.to) {
        params.push(filters.to);
        where.push(`o.created_at <= $${params.length}`);
    }

    const result = await query(`
        SELECT
            o.id,
            o.status,
            o.total,
            o.created_at,
            c.name AS customer_name,
            c.email AS customer_email
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY o.created_at DESC
        LIMIT 200
    `, params);

    return result.rows;
}

module.exports = {
    searchOrders
};
