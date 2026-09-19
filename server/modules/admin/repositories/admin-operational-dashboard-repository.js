const { query } = require("./admin-db");

async function getOperationalDashboard() {
    const [
        orders,
        payments,
        inventory,
        customers,
        logistics,
        coupons
    ] = await Promise.all([
        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'processing') AS processing,
                COUNT(*) FILTER (WHERE status = 'shipped') AS shipped,
                COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
                COALESCE(SUM(total), 0) AS revenue
            FROM orders
        `),

        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'paid') AS paid,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid_amount
            FROM payments
        `),

        query(`
            SELECT
                COUNT(*) FILTER (WHERE stock <= 0) AS out_of_stock,
                COUNT(*) FILTER (WHERE stock > 0 AND stock <= 5) AS critical,
                COALESCE(SUM(stock), 0) AS total_units
            FROM products
            WHERE active = TRUE
        `),

        query(`
            SELECT COUNT(*) AS total
            FROM customers
        `),

        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE status IN ('pending', 'processing')
                ) AS pending
            FROM shipments
        `),

        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE active = TRUE
                ) AS active
            FROM coupons
        `)
    ]);

    return {
        orders: orders.rows[0] || {},
        payments: payments.rows[0] || {},
        inventory: inventory.rows[0] || {},
        customers: customers.rows[0] || {},
        logistics: logistics.rows[0] || {},
        coupons: coupons.rows[0] || {}
    };
}

module.exports = {
    getOperationalDashboard
};
