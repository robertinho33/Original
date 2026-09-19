const { query } = require("./admin-db");

async function getAdminUsers() {
    const result = await query(
        `
        SELECT
            au.id,
            au.email,
            au.active,
            ar.name AS role,
            au.created_at
        FROM admin_users au
        LEFT JOIN admin_roles ar
            ON ar.id = au.role_id
        ORDER BY au.created_at
        `
    );

    return result.rows;
}

module.exports = {
    getAdminUsers
};
