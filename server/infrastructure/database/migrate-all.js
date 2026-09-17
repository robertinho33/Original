'use strict';

const fs = require('fs');
const path = require('path');
const { query } = require('../postgres');

const ROOT = process.cwd();

const FILES = {
    orders: path.join(ROOT, 'server', 'data', 'orders.json'),
    inventory: path.join(ROOT, 'server', 'data', 'inventory', 'inventory.json'),
    audit: path.join(ROOT, 'server', 'data', 'audit', 'events.json')
};

function readJson(file) {
    if (!fs.existsSync(file)) {
        throw new Error(`Arquivo não encontrado: ${file}`);
    }

    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (value && typeof value === 'object') {
        return Object.values(value);
    }

    return [];
}

function normalizeOrder(item) {
    const orderNumber =
        item.orderNumber ??
        item.order_number ??
        item.number ??
        item.id;

    if (!orderNumber) {
        return null;
    }

    return {
        orderNumber: String(orderNumber),
        status: item.status ?? 'awaiting_payment',
        customer: item.customer ?? {},
        items: Array.isArray(item.items) ? item.items : [],
        shipping: item.shipping ?? {},
        payment: item.payment ?? {},
        totals: item.totals ?? {},
        metadata: item.metadata ?? {}
    };
}

function normalizeInventory(item) {
    const sku = item.sku ?? item.SKU;

    if (!sku) {
        return null;
    }

    return {
        sku: String(sku),
        product: String(item.product ?? item.Produto ?? ''),
        stock: Number(item.stock ?? item.estoque ?? item.Estoque ?? 0),
        reserved: Number(item.reserved ?? item.reservado ?? 0)
    };
}

function normalizeAudit(item) {
    const eventId =
        item.eventId ??
        item.event_id ??
        item.id;

    if (!eventId) {
        return null;
    }

    return {
        eventId: String(eventId),
        eventType: String(
            item.eventType ??
            item.event_type ??
            item.type ??
            'unknown'
        ),
        orderNumber:
            item.orderNumber ??
            item.order_number ??
            null,
        payload: item.payload ?? item.data ?? item,
        previousHash:
            item.previousHash ??
            item.previous_hash ??
            null,
        eventHash:
            item.eventHash ??
            item.event_hash ??
            null,
        createdAt:
            item.createdAt ??
            item.created_at ??
            new Date().toISOString()
    };
}

async function migrateOrders() {
    const source = readJson(FILES.orders);
    const rows = asArray(source);

    let inserted = 0;
    let skipped = 0;

    for (const raw of rows) {
        const order = normalizeOrder(raw);

        if (!order) {
            skipped++;
            continue;
        }

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
                metadata
            )
            VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)
            ON CONFLICT (order_number) DO NOTHING
            `,
            [
                order.orderNumber,
                order.status,
                JSON.stringify(order.customer),
                JSON.stringify(order.items),
                JSON.stringify(order.shipping),
                JSON.stringify(order.payment),
                JSON.stringify(order.totals),
                JSON.stringify(order.metadata)
            ]
        );

        if (result.rowCount === 1) {
            inserted++;
        } else {
            skipped++;
        }
    }

    return {
        source: rows.length,
        inserted,
        skipped
    };
}

async function migrateInventory() {
    const source = readJson(FILES.inventory);
    const rows = asArray(source);

    let inserted = 0;
    let skipped = 0;

    for (const raw of rows) {
        const item = normalizeInventory(raw);

        if (!item) {
            skipped++;
            continue;
        }

        const result = await query(
            `
            INSERT INTO inventory (
                sku,
                product,
                stock,
                reserved
            )
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (sku) DO UPDATE SET
                product = EXCLUDED.product,
                stock = EXCLUDED.stock,
                reserved = EXCLUDED.reserved,
                updated_at = NOW()
            `,
            [
                item.sku,
                item.product,
                item.stock,
                item.reserved
            ]
        );

        if (result.rowCount === 1) {
            inserted++;
        } else {
            skipped++;
        }
    }

    return {
        source: rows.length,
        processed: inserted,
        skipped
    };
}

async function migrateAudit() {
    const source = readJson(FILES.audit);
    const rows = asArray(source);

    let inserted = 0;
    let skipped = 0;

    for (const raw of rows) {
        const event = normalizeAudit(raw);

        if (!event) {
            skipped++;
            continue;
        }

        const result = await query(
            `
            INSERT INTO audit_events (
                event_id,
                event_type,
                order_number,
                payload,
                previous_hash,
                event_hash,
                created_at
            )
            VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
            ON CONFLICT (event_id) DO NOTHING
            `,
            [
                event.eventId,
                event.eventType,
                event.orderNumber,
                JSON.stringify(event.payload),
                event.previousHash,
                event.eventHash,
                event.createdAt
            ]
        );

        if (result.rowCount === 1) {
            inserted++;
        } else {
            skipped++;
        }
    }

    return {
        source: rows.length,
        inserted,
        skipped
    };
}

async function main() {
    console.log('');
    console.log('==================================================');
    console.log(' AUREA — MIGRAÇÃO JSON → POSTGRESQL');
    console.log('==================================================');

    console.log('[1/4] Verificando banco...');

    const database = await query(
        'SELECT current_database() AS database, current_user AS user'
    );

    console.log(`Banco: ${database.rows[0].database}`);
    console.log(`Usuário: ${database.rows[0].user}`);

    console.log('[2/4] Migrando pedidos...');
    const orders = await migrateOrders();
    console.log(JSON.stringify(orders, null, 2));

    console.log('[3/4] Migrando estoque...');
    const inventory = await migrateInventory();
    console.log(JSON.stringify(inventory, null, 2));

    console.log('[4/4] Migrando auditoria...');
    const audit = await migrateAudit();
    console.log(JSON.stringify(audit, null, 2));

    const counts = await Promise.all([
        query('SELECT COUNT(*)::int AS count FROM orders'),
        query('SELECT COUNT(*)::int AS count FROM inventory'),
        query('SELECT COUNT(*)::int AS count FROM audit_events')
    ]);

    console.log('');
    console.log('==================================================');
    console.log(' MIGRAÇÃO CONCLUÍDA');
    console.log('==================================================');
    console.log(`orders       : ${counts[0].rows[0].count}`);
    console.log(`inventory    : ${counts[1].rows[0].count}`);
    console.log(`audit_events : ${counts[2].rows[0].count}`);
}

main().catch((error) => {
    console.error('');
    console.error('==================================================');
    console.error(' FALHA NA MIGRAÇÃO');
    console.error('==================================================');
    console.error(error.message);
    process.exitCode = 1;
});
