const { query } = require("./admin-db");

async function getAudit(limit = 200) {
    const result = await query(
        `
        SELECT *
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [Math.min(Number(limit) || 200, 500)]
    );

    return result.rows;
}

module.exports = {
    getAudit
};
