'use strict';

const { query } = require('../../infrastructure/postgres');

function normalizeOrder(order) {
    return {
        ...order,
        orderNumber:
            order.orderNumber ??
            order.order_number,

        createdAt:
            order.createdAt ??
            order.created_at,

        updatedAt:
            order.updatedAt ??
            order.updated_at
    };
}

async function createOrder(order) {
    const normalized = normalizeOrder(order);

    const result = await query(
        `
        INSERT INTO orders (
            order_number,
            status,
            customer,
            items,
            shipping,
            payment,
            totals,
            metadata,
            created_at,
            updated_at
        )
        VALUES (
            $1,
            $2,
            $3::jsonb,
            $4::jsonb,
            $5::jsonb,
            $6::jsonb,
            $7::jsonb,
            $8::jsonb,
            COALESCE($9::timestamptz, NOW()),
            COALESCE($10::timestamptz, NOW())
        )
        RETURNING *
        `,
        [
            normalized.orderNumber,
            normalized.status ?? 'awaiting_payment',
            JSON.stringify(normalized.customer ?? {}),
            JSON.stringify(normalized.items ?? []),
            JSON.stringify(normalized.shipping ?? null),
            JSON.stringify(normalized.payment ?? null),
            JSON.stringify(normalized.totals ?? {}),
            JSON.stringify(normalized.metadata ?? {}),
            normalized.createdAt ?? null,
            normalized.updatedAt ?? null
        ]
    );

    return mapRow(result.rows[0]);
}

async function findByOrderNumber(orderNumber) {
    const result = await query(
        `
        SELECT *
        FROM orders
        WHERE order_number = $1
        LIMIT 1
        `,
        [orderNumber]
    );

    return result.rows.length
        ? mapRow(result.rows[0])
        : null;
}

async function findAll(options = {}) {
    const limit = Math.min(
        Math.max(Number(options.limit) || 100, 1),
        1000
    );

    const offset = Math.max(
        Number(options.offset) || 0,
        0
    );

    const result = await query(
        `
        SELECT *
        FROM orders
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2
        `,
        [limit, offset]
    );

    return result.rows.map(mapRow);
}

async function updateOrder(orderNumber, patch = {}) {
    const current = await findByOrderNumber(orderNumber);

    if (!current) {
        return null;
    }

    const merged = {
        ...current,
        ...patch,
        orderNumber: current.orderNumber,
        updatedAt: new Date().toISOString()
    };

    const result = await query(
        `
        UPDATE orders
        SET
            status = $2,
            customer = $3::jsonb,
            items = $4::jsonb,
            shipping = $5::jsonb,
            payment = $6::jsonb,
            totals = $7::jsonb,
            metadata = $8::jsonb,
            updated_at = $9::timestamptz
        WHERE order_number = $1
        RETURNING *
        `,
        [
            orderNumber,
            merged.status ?? 'awaiting_payment',
            JSON.stringify(merged.customer ?? {}),
            JSON.stringify(merged.items ?? []),
            JSON.stringify(merged.shipping ?? null),
            JSON.stringify(merged.payment ?? null),
            JSON.stringify(merged.totals ?? {}),
            JSON.stringify(merged.metadata ?? {}),
            merged.updatedAt
        ]
    );

    return result.rows.length
        ? mapRow(result.rows[0])
        : null;
}

async function countOrders() {
    const result = await query(
        `
        SELECT COUNT(*)::integer AS total
        FROM orders
        `
    );

    return result.rows[0].total;
}

function mapRow(row) {
    if (!row) {
        return null;
    }

    return {
        orderNumber: row.order_number,
        status: row.status,
        customer: row.customer,
        items: row.items,
        shipping: row.shipping,
        payment: row.payment,
        totals: row.totals,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

module.exports = {
    createOrder,
    findByOrderNumber,
    findAll,
    updateOrder,
    countOrders
};
