'use strict';

const fs = require('fs');
const path = require('path');

const { query } = require('../postgres');

const ORDERS_FILE = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'orders.json'
);

function readOrdersFile() {
    if (!fs.existsSync(ORDERS_FILE)) {
        return [];
    }

    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');

    if (!raw.trim()) {
        return [];
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
        return parsed;
    }

    if (Array.isArray(parsed.orders)) {
        return parsed.orders;
    }

    return [];
}

function normalizeOrder(order) {
    return {
        orderNumber:
            order.orderNumber ??
            order.order_number,

        status:
            order.status ??
            'awaiting_payment',

        customer:
            order.customer ??
            {},

        items:
            order.items ??
            [],

        shipping:
            order.shipping ??
            null,

        payment:
            order.payment ??
            null,

        totals:
            order.totals ??
            {},

        metadata:
            order.metadata ??
            {},

        createdAt:
            order.createdAt ??
            order.created_at ??
            null,

        updatedAt:
            order.updatedAt ??
            order.updated_at ??
            null
    };
}

async function migrateOrder(order) {
    const normalized = normalizeOrder(order);

    if (!normalized.orderNumber) {
        return {
            status: 'skipped',
            reason: 'missing_order_number'
        };
    }

    const existing = await query(
        `
        SELECT id
        FROM orders
        WHERE order_number = $1
        LIMIT 1
        `,
        [normalized.orderNumber]
    );

    if (existing.rows.length > 0) {
        return {
            status: 'skipped',
            reason: 'already_exists',
            orderNumber: normalized.orderNumber
        };
    }

    await query(
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
        `,
        [
            normalized.orderNumber,
            normalized.status,
            JSON.stringify(normalized.customer),
            JSON.stringify(normalized.items),
            JSON.stringify(normalized.shipping),
            JSON.stringify(normalized.payment),
            JSON.stringify(normalized.totals),
            JSON.stringify(normalized.metadata),
            normalized.createdAt,
            normalized.updatedAt
        ]
    );

    return {
        status: 'migrated',
        orderNumber: normalized.orderNumber
    };
}

async function migrateOrders() {
    const orders = readOrdersFile();

    const summary = {
        total: orders.length,
        migrated: 0,
        skipped: 0,
        errors: 0
    };

    for (const order of orders) {
        try {
            const result = await migrateOrder(order);

            if (result.status === 'migrated') {
                summary.migrated++;
                console.log(
                    `[MIGRATION] Pedido migrado: ${result.orderNumber}`
                );
            } else {
                summary.skipped++;
                console.log(
                    `[MIGRATION] Pedido ignorado: ${result.orderNumber ?? result.reason}`
                );
            }
        } catch (error) {
            summary.errors++;

            console.error(
                '[MIGRATION] Erro ao migrar pedido:',
                error.message
            );
        }
    }

    return summary;
}

if (require.main === module) {
    migrateOrders()
        .then((summary) => {
            console.log('\n===== RESULTADO DA MIGRAÇÃO =====');
            console.log(JSON.stringify(summary, null, 2));
        })
        .catch((error) => {
            console.error(
                '[MIGRATION] Falha:',
                error.message
            );

            process.exitCode = 1;
        });
}

module.exports = {
    migrateOrders,
    readOrdersFile
};
