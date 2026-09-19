const { query, transaction } = require("./admin-db");

async function activateProduct(id, active) {
    return transaction(async (client) => {
        const before = await client.query(
            "SELECT * FROM products WHERE id = $1 FOR UPDATE",
            [id]
        );

        if (!before.rows[0]) {
            throw new Error("Produto não encontrado.");
        }

        const result = await client.query(`
            UPDATE products
            SET active = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id, active]);

        await client.query(`
            INSERT INTO audit_logs
                (action, entity_type, entity_id, details, created_at)
            VALUES
                ('product_activation', 'product', $1, $2, NOW())
        `, [
            id,
            JSON.stringify({
                before: before.rows[0],
                after: result.rows[0]
            })
        ]);

        return result.rows[0];
    });
}

async function getProductHistory(id) {
    const result = await query(`
        SELECT *
        FROM audit_logs
        WHERE entity_type = 'product'
          AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 100
    `, [id]);

    return result.rows;
}

module.exports = {
    activateProduct,
    getProductHistory
};
