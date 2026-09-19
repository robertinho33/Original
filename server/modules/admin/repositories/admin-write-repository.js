const { transaction } = require("./admin-db");

async function updateProduct(id, data) {
    return transaction(async (client) => {
        const result = await client.query(
            `
            UPDATE products
               SET name = COALESCE($2, name),
                   description = COALESCE($3, description),
                   price = COALESCE($4, price),
                   category_id = COALESCE($5, category_id),
                   updated_at = NOW()
             WHERE id = $1
         RETURNING *
            `,
            [
                id,
                data.name ?? null,
                data.description ?? null,
                data.price ?? null,
                data.categoryId ?? null
            ]
        );

        if (!result.rows.length) {
            throw new Error("Produto não encontrado.");
        }

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('UPDATE', 'product', $1, $2::jsonb, NOW())
            `,
            [
                id,
                JSON.stringify({
                    source: "admin",
                    fields: Object.keys(data)
                })
            ]
        );

        return result.rows[0];
    });
}

async function updateOrderStatus(id, status) {
    return transaction(async (client) => {
        const result = await client.query(
            `
            UPDATE orders
               SET status = $2,
                   updated_at = NOW()
             WHERE id = $1
         RETURNING *
            `,
            [id, status]
        );

        if (!result.rows.length) {
            throw new Error("Pedido não encontrado.");
        }

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('UPDATE', 'order', $1, $2::jsonb, NOW())
            `,
            [
                id,
                JSON.stringify({
                    source: "admin",
                    status
                })
            ]
        );

        return result.rows[0];
    });
}

async function createInventoryMovement(data) {
    return transaction(async (client) => {
        const result = await client.query(
            `
            INSERT INTO inventory_movements
                (product_id, movement_type, quantity, reason, created_at)
            VALUES
                ($1, $2, $3, $4, NOW())
         RETURNING *
            `,
            [
                data.productId,
                data.type,
                data.quantity,
                data.reason || "Movimentação administrativa"
            ]
        );

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('CREATE', 'inventory_movement', $1, $2::jsonb, NOW())
            `,
            [
                result.rows[0].id,
                JSON.stringify({
                    source: "admin",
                    productId: data.productId,
                    type: data.type,
                    quantity: data.quantity
                })
            ]
        );

        return result.rows[0];
    });
}

async function updateShipment(id, data) {
    return transaction(async (client) => {
        const result = await client.query(
            `
            UPDATE shipments
               SET status = COALESCE($2, status),
                   tracking_code = COALESCE($3, tracking_code),
                   updated_at = NOW()
             WHERE id = $1
         RETURNING *
            `,
            [
                id,
                data.status ?? null,
                data.trackingCode ?? null
            ]
        );

        if (!result.rows.length) {
            throw new Error("Envio não encontrado.");
        }

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('UPDATE', 'shipment', $1, $2::jsonb, NOW())
            `,
            [
                id,
                JSON.stringify({
                    source: "admin",
                    fields: Object.keys(data)
                })
            ]
        );

        return result.rows[0];
    });
}

async function updateSettings(data) {
    return transaction(async (client) => {
        for (const [key, value] of Object.entries(data)) {
            await client.query(
                `
                INSERT INTO admin_settings
                    (key, value, updated_at)
                VALUES
                    ($1, $2::jsonb, NOW())
                ON CONFLICT (key)
                DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()
                `,
                [key, JSON.stringify(value)]
            );
        }

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, metadata, created_at)
            VALUES
                ('UPDATE', 'settings', $1::jsonb, NOW())
            `,
            [
                JSON.stringify({
                    source: "admin",
                    keys: Object.keys(data)
                })
            ]
        );

        return data;
    });
}

module.exports = {
    updateProduct,
    updateOrderStatus,
    createInventoryMovement,
    updateShipment,
    updateSettings
};
