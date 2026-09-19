const { query } = require("./admin-db");

async function getPendingPayments() {
    const result = await query(`
        SELECT
            p.*,
            o.order_number,
            o.total
        FROM payments p
        JOIN orders o
            ON o.id = p.order_id
        WHERE p.status IN (
            'pending',
            'awaiting_payment'
        )
        ORDER BY p.created_at DESC
    `);

    return result.rows;
}

module.exports = {
    getPendingPayments
};
