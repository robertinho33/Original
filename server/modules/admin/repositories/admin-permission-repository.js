const {
    query
} = require("./admin-db");

async function getUserByToken(token) {

    const result = await query(
        `
        SELECT
            au.id,
            au.email,
            au.active,
            ar.name AS role,
            ar.permissions
        FROM admin_users au
        LEFT JOIN admin_roles ar
            ON ar.id = au.role_id
        WHERE au.active = TRUE
          AND au.email = $1
        LIMIT 1
        `,
        [token]
    );

    return result.rows[0] || null;
}

async function getRoles() {

    const result = await query(
        `
        SELECT
            id,
            name,
            description,
            permissions,
            active,
            created_at,
            updated_at
        FROM admin_roles
        ORDER BY name
        `
    );

    return result.rows;
}

module.exports = {
    getUserByToken,
    getRoles
};
