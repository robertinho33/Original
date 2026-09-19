const { query } = require("./admin-db");

async function getCouponDetails(id) {
    const result = await query(`
        SELECT *
        FROM coupons
        WHERE id = $1
        LIMIT 1
    `, [id]);

    return result.rows[0] || null;
}

async function listCoupons() {
    const result = await query(`
        SELECT *
        FROM coupons
        ORDER BY created_at DESC
    `);

    return result.rows;
}

module.exports = {
    getCouponDetails,
    listCoupons
};
