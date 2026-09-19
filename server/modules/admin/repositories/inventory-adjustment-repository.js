const { transaction } =
    require("./admin-db");

async function adjustStock(data) {
    return transaction(async client => {
        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity === 0) {
            throw new Error("Quantidade de estoque inválida.");
        }

        const result = await client.query(
            `
            UPDATE products
            SET
                stock = stock + $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [data.product_id, quantity]
        );

        if (!result.rows[0]) {
            throw new Error("Produto não encontrado.");
        }

        if (result.rows[0].stock < 0) {
            throw new Error(
                "O estoque não pode ficar negativo."
            );
        }

        await client.query(
            `
            INSERT INTO inventory_movements
            (
                product_id,
                quantity,
                movement_type,
                reason,
                created_at
            )
            VALUES ($1,$2,$3,$4,NOW())
            `,
            [
                data.product_id,
                quantity,
                quantity > 0 ? "in" : "out",
                data.reason || "Ajuste administrativo"
            ]
        );

        await client.query(
            `
            INSERT INTO audit_logs
            (action, entity_type, entity_id, details)
            VALUES ('adjust','inventory',$1,$2)
            `,
            [
                data.product_id,
                JSON.stringify(data)
            ]
        );

        return result.rows[0];
    });
}

module.exports = {
    adjustStock
};
