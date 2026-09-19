const { query } = require("./admin-db");

async function getDailySales(days = 30) {
    const result = await query(
        `
        SELECT
            DATE(created_at) AS day,
            COUNT(*) AS orders,
            COALESCE(
                SUM(total) FILTER (
                    WHERE status = 'paid'
                ),
                0
            ) AS revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE - ($1::integer)
        GROUP BY DATE(created_at)
        ORDER BY day
        `,
        [Number(days)]
    );

    return result.rows;
}

module.exports = {
    getDailySales
};
