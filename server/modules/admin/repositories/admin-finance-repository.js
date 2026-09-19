const { query } = require("./admin-db");

async function getFinancialDetails() {
    const payments = await query(`
        SELECT
            p.id,
            p.order_id,
            p.method,
            p.status,
            p.amount,
            p.transaction_id,
            p.created_at
        FROM payments p
        ORDER BY p.created_at DESC
        LIMIT 100
    `);

    const summary = await query(`
        SELECT *
        FROM admin_financial_summary
        LIMIT 1
    `);

    return {
        summary: summary.rows[0] || {},
        payments: payments.rows
    };
}

module.exports = {
    getFinancialDetails
};
