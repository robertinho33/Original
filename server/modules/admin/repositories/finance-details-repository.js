const { query } = require("./admin-db");

async function getFinanceDetails() {
    const summary = await query(
        `
        SELECT
            COUNT(*) FILTER (
                WHERE status = 'paid'
            ) AS paid_orders,
            COUNT(*) FILTER (
                WHERE status = 'pending'
            ) AS pending_orders,
            COALESCE(SUM(total) FILTER (
                WHERE status = 'paid'
            ), 0) AS paid_total,
            COALESCE(SUM(total) FILTER (
                WHERE status = 'pending'
            ), 0) AS pending_total
        FROM orders
        `
    );

    const payments = await query(
        `
        SELECT *
        FROM payments
        ORDER BY created_at DESC
        LIMIT 100
        `
    );

    return {
        summary: summary.rows[0],
        payments: payments.rows
    };
}

module.exports = {
    getFinanceDetails
};
