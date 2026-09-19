const { query, transaction } = require("./admin-db");

async function getStockDetails(productId) {
    const product = await query(`
        SELECT
            p.id,
            p.sku,
            p.name,
            COALESCE(p.stock, 0) AS stock,
            COALESCE(
                (
                    SELECT SUM(ir.quantity)
                    FROM inventory_reservations ir
                    WHERE ir.product_id = p.id
                      AND ir.status = 'reserved'
                ),
                0
            ) AS reserved_stock
        FROM products p
        WHERE p.id = $1
        LIMIT 1
    `, [productId]);

    return product.rows[0] || null;
}

async function createMovement(data) {
    return transaction(async (client) => {
        const productId = Number(data.product_id);
        const quantity = Number(data.quantity);

        if (!productId || !quantity || quantity === 0) {
            throw new Error("Produto e quantidade são obrigatórios.");
        }

        const productResult = await client.query(`
            SELECT id, stock
            FROM products
            WHERE id = $1
            FOR UPDATE
        `, [productId]);

        const product = productResult.rows[0];

        if (!product) {
            throw new Error("Produto não encontrado.");
        }

        const nextStock = Number(product.stock || 0) + quantity;

        if (nextStock < 0) {
            throw new Error("Estoque insuficiente.");
        }

        await client.query(`
            UPDATE products
            SET
                stock = $2,
                updated_at = NOW()
            WHERE id = $1
        `, [
            productId,
            nextStock
        ]);

        const movementResult = await client.query(`
            INSERT INTO inventory_movements (
                product_id,
                quantity,
                type,
                reason,
                created_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                NOW()
            )
            RETURNING *
        `, [
            productId,
            quantity,
            data.type || (quantity > 0 ? "in" : "out"),
            data.reason || "admin"
        ]);

        await client.query(`
            INSERT INTO audit_logs (
                action,
                entity_type,
                entity_id,
                details,
                created_at
            )
            VALUES (
                'inventory_movement',
                'product',
                $1,
                $2::jsonb,
                NOW()
            )
        `, [
            productId,
            JSON.stringify({
                quantity,
                nextStock,
                reason: data.reason || "admin"
            })
        ]);

        return {
            product_id: productId,
            previous_stock: Number(product.stock || 0),
            movement: quantity,
            current_stock: nextStock,
            record: movementResult.rows[0]
        };
    });
}

async function getReservations() {
    const result = await query(`
        SELECT
            ir.*,
            p.sku,
            p.name
        FROM inventory_reservations ir
        LEFT JOIN products p ON p.id = ir.product_id
        ORDER BY ir.created_at DESC
    `);

    return result.rows;
}

module.exports = {
    getStockDetails,
    createMovement,
    getReservations
};
