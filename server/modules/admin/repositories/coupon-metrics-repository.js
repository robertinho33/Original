const { query } = require("./admin-db");

async function getCouponMetrics() {
    const result = await query(`
        SELECT
            c.id,
            c.code,
            c.active,
            COUNT(o.id) AS uses,
            COALESCE(SUM(o.discount),0) AS total_discount
        FROM coupons c
        LEFT JOIN orders o
            ON o.coupon_id = c.id
        GROUP BY c.id
        ORDER BY uses DESC, c.code
    `);

    return result.rows;
}

module.exports = {
    getCouponMetrics
};
