const { query } = require("./admin-db");

async function getFinanceMetrics() {
    const result = await query(`
        SELECT
            COALESCE(SUM(total) FILTER (
                WHERE status = 'paid'
                AND created_at >= CURRENT_DATE
            ),0) AS revenue_today,

            COALESCE(SUM(total) FILTER (
                WHERE status = 'paid'
                AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
            ),0) AS revenue_month,

            COUNT(*) FILTER (
                WHERE status = 'paid'
            ) AS paid_orders,

            COUNT(*) FILTER (
                WHERE status IN (
                    'pending',
                    'awaiting_payment'
                )
            ) AS pending_orders,

            COALESCE(AVG(total) FILTER (
                WHERE status = 'paid'
            ),0) AS average_ticket
        FROM orders
    `);

    return result.rows[0];
}

module.exports = {
    getFinanceMetrics
};
