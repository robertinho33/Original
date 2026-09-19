const { query } = require("./admin-db");

async function getCustomerPerformance() {
    const result = await query(`
        SELECT
            c.id,
            c.name,
            c.email,
            COUNT(o.id) AS orders_count,
            COALESCE(
                SUM(
                    CASE
                        WHEN o.status = 'paid'
                        THEN o.total
                        ELSE 0
                    END
                ),
                0
            ) AS revenue
        FROM customers c
        LEFT JOIN orders o
            ON o.customer_id = c.id
        GROUP BY c.id
        ORDER BY revenue DESC
    `);

    return result.rows;
}

module.exports = {
    getCustomerPerformance
};
