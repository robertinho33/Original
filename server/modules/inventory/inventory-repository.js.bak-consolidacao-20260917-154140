'use strict';

const { query } = require('../../infrastructure/postgres');

function mapItem(row) {
    if (!row) {
        return null;
    }

    return {
        sku: row.sku,
        product: row.product,
        stock: Number(row.stock),
        reserved: Number(row.reserved),
        updatedAt: row.updated_at
    };
}

function mapReservation(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.reservation_id,
        orderNumber: row.order_number,
        sku: row.sku,
        quantity: Number(row.quantity),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getItem(sku) {
    const result = await query(
        `
        SELECT
            sku,
            product,
            stock,
            reserved,
            updated_at
        FROM inventory
        WHERE sku = $1
        `,
        [String(sku)]
    );

    return mapItem(result.rows[0]);
}

async function getAllItems() {
    const result = await query(
        `
        SELECT
            sku,
            product,
            stock,
            reserved,
            updated_at
        FROM inventory
        ORDER BY sku
        `
    );

    return result.rows.map(mapItem);
}

async function saveItem(item) {
    if (!item || !item.sku) {
        throw new Error('SKU obrigatória para estoque.');
    }

    const result = await query(
        `
        INSERT INTO inventory (
            sku,
            product,
            stock,
            reserved
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sku)
        DO UPDATE SET
            product = EXCLUDED.product,
            stock = EXCLUDED.stock,
            reserved = EXCLUDED.reserved,
            updated_at = NOW()
        RETURNING
            sku,
            product,
            stock,
            reserved,
            updated_at
        `,
        [
            String(item.sku),
            item.product || null,
            Number(item.stock || 0),
            Number(item.reserved || 0)
        ]
    );

    return mapItem(result.rows[0]);
}

async function updateItem(sku, changes = {}) {
    const current = await getItem(sku);

    if (!current) {
        return null;
    }

    const next = {
        sku: current.sku,
        product:
            changes.product !== undefined
                ? changes.product
                : current.product,
        stock:
            changes.stock !== undefined
                ? Number(changes.stock)
                : current.stock,
        reserved:
            changes.reserved !== undefined
                ? Number(changes.reserved)
                : current.reserved
    };

    return saveItem(next);
}

async function saveReservation(reservation) {
    if (!reservation || !reservation.id) {
        throw new Error('Reserva inválida.');
    }

    const result = await query(
        `
        INSERT INTO inventory_reservations (
            reservation_id,
            order_number,
            sku,
            quantity,
            status
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (reservation_id)
        DO UPDATE SET
            order_number = EXCLUDED.order_number,
            sku = EXCLUDED.sku,
            quantity = EXCLUDED.quantity,
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING
            reservation_id,
            order_number,
            sku,
            quantity,
            status,
            created_at,
            updated_at
        `,
        [
            String(reservation.id),
            reservation.orderNumber || null,
            String(reservation.sku),
            Number(reservation.quantity),
            reservation.status || 'reserved'
        ]
    );

    return mapReservation(result.rows[0]);
}

async function getReservation(id) {
    const result = await query(
        `
        SELECT
            reservation_id,
            order_number,
            sku,
            quantity,
            status,
            created_at,
            updated_at
        FROM inventory_reservations
        WHERE reservation_id = $1
        `,
        [String(id)]
    );

    return mapReservation(result.rows[0]);
}

async function deleteReservation(id) {
    await query(
        `
        DELETE FROM inventory_reservations
        WHERE reservation_id = $1
        `,
        [String(id)]
    );
}

async function getAllReservations() {
    const result = await query(
        `
        SELECT
            reservation_id,
            order_number,
            sku,
            quantity,
            status,
            created_at,
            updated_at
        FROM inventory_reservations
        ORDER BY created_at DESC
        `
    );

    return result.rows.map(mapReservation);
}

module.exports = {
    getItem,
    getAllItems,
    saveItem,
    updateItem,
    saveReservation,
    getReservation,
    deleteReservation,
    getAllReservations
};
