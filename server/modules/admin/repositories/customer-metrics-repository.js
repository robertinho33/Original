const { query } = require("./admin-db");

async function getCustomerMetrics(id) {
    const result = await query(
        `
        SELECT
            c.id,
            c.name,
            c.email,
            COUNT(o.id) AS orders_count,
            COALESCE(SUM(
                CASE
                    WHEN o.status = 'paid'
                    THEN o.total
                    ELSE 0
                END
            ),0) AS lifetime_value,
            MAX(o.created_at) AS last_order_at
        FROM customers c
        LEFT JOIN orders o
            ON o.customer_id = c.id
        WHERE c.id = $1
        GROUP BY c.id
        `,
        [id]
    );

    return result.rows[0] || null;
}

module.exports = {
    getCustomerMetrics
};
