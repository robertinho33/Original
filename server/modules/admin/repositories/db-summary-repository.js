const { query } = require("./admin-db");

async function getDatabaseSummary() {
    const result = await query(`
        SELECT
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM categories) AS categories,
            (SELECT COUNT(*) FROM customers) AS customers,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM coupons) AS coupons,
            (SELECT COUNT(*) FROM payments) AS payments,
            (SELECT COUNT(*) FROM shipments) AS shipments,
            (SELECT COUNT(*) FROM inventory_movements) AS inventory_movements,
            (SELECT COUNT(*) FROM audit_logs) AS audit_logs
    `);

    return result.rows[0];
}

module.exports = {
    getDatabaseSummary
};
