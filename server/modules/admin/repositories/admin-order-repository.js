const { query, transaction } = require("./admin-db");

async function getOrderById(id) {
    const result = await query(`
        SELECT *
        FROM admin_order_summary
        WHERE id = $1
        LIMIT 1
    `, [id]);

    return result.rows[0] || null;
}

async function getOrderItems(orderId) {
    const result = await query(`
        SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.quantity,
            oi.unit_price,
            p.sku,
            p.name,
            p.image_url
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1
        ORDER BY oi.id
    `, [orderId]);

    return result.rows;
}

async function getOrderPayments(orderId) {
    const result = await query(`
        SELECT
            id,
            order_id,
            method,
            status,
            amount,
            transaction_id,
            created_at,
            updated_at
        FROM payments
        WHERE order_id = $1
        ORDER BY created_at DESC
    `, [orderId]);

    return result.rows;
}

async function getOrderShipment(orderId) {
    const result = await query(`
        SELECT
            id,
            order_id,
            carrier,
            tracking_code,
            status,
            shipped_at,
            delivered_at,
            created_at,
            updated_at
        FROM shipments
        WHERE order_id = $1
        ORDER BY id DESC
        LIMIT 1
    `, [orderId]);

    return result.rows[0] || null;
}

async function getOrderDetails(id) {
    const order = await getOrderById(id);

    if (!order) {
        return null;
    }

    const [items, payments, shipment] = await Promise.all([
        getOrderItems(id),
        getOrderPayments(id),
        getOrderShipment(id)
    ]);

    return {
        order,
        items,
        payments,
        shipment
    };
}

async function updateOrderStatus(id, status) {
    return transaction(async (client) => {
        const result = await client.query(`
            UPDATE orders
            SET
                status = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id, status]);

        if (!result.rows[0]) {
            throw new Error("Pedido não encontrado.");
        }

        await client.query(`
            INSERT INTO audit_logs (
                action,
                entity_type,
                entity_id,
                details,
                created_at
            )
            VALUES (
                'update',
                'order',
                $1,
                $2::jsonb,
                NOW()
            )
        `, [
            id,
            JSON.stringify({
                status
            })
        ]);

        return result.rows[0];
    });
}

module.exports = {
    getOrderById,
    getOrderItems,
    getOrderPayments,
    getOrderShipment,
    getOrderDetails,
    updateOrderStatus
};
