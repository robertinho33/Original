const { query } = require("./admin-db");

async function getEntityAudit(entityType, entityId) {
    const result = await query(
        `
        SELECT *
        FROM audit_logs
        WHERE entity_type = $1
          AND entity_id = $2
        ORDER BY created_at DESC
        `,
        [entityType, entityId]
    );

    return result.rows;
}

module.exports = {
    getEntityAudit
};
