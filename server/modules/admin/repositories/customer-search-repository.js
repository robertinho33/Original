const { query } = require("./admin-db");

async function searchCustomers(term) {
    const value = `%${String(term || "").trim()}%`;

    if (String(term || "").trim().length < 2) {
        return [];
    }

    const result = await query(
        `
        SELECT
            id,
            name,
            email,
            phone,
            created_at
        FROM customers
        WHERE
            name ILIKE $1
            OR email ILIKE $1
            OR phone ILIKE $1
        ORDER BY name
        LIMIT 100
        `,
        [value]
    );

    return result.rows;
}

module.exports = {
    searchCustomers
};
