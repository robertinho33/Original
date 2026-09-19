const { query } = require("./admin-db");

async function getNotifications() {
    const result = await query(`
        SELECT *
        FROM (
            SELECT
                'stock' AS type,
                p.id::text AS reference,
                'Estoque crítico' AS title,
                p.name AS message,
                p.updated_at AS created_at
            FROM products p
            WHERE p.stock <= 5
              AND p.active = TRUE

            UNION ALL

            SELECT
                'payment' AS type,
                o.id::text AS reference,
                'Pagamento pendente' AS title,
                o.order_number AS message,
                o.created_at
            FROM orders o
            WHERE o.status IN ('pending','awaiting_payment')
        ) notifications
        ORDER BY created_at DESC
        LIMIT 50
    `);

    return result.rows;
}

module.exports = {
    getNotifications
};
