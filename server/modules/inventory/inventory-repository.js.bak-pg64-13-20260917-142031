'use strict';

const { query, transaction } = require('../../infrastructure/postgres');

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
        reservationId: row.reservation_id,
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
        SELECT *
        FROM inventory
        WHERE sku = $1
        LIMIT 1
        `,
        [sku]
    );

    return mapItem(result.rows[0]);
}

async function getAllItems() {
    const result = await query(
        `
        SELECT *
        FROM inventory
        ORDER BY sku
        `
    );

    return result.rows.map(mapItem);
}

async function saveItem(item) {
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
        RETURNING *
        `,
        [
            item.sku,
            item.product || '',
            Number(item.stock) || 0,
            Number(item.reserved) || 0
        ]
    );

    return mapItem(result.rows[0]);
}

async function updateItem(sku, changes) {
    const current = await getItem(sku);

    if (!current) {
        return null;
    }

    const result = await query(
        `
        UPDATE inventory
        SET
            product = $2,
            stock = $3,
            reserved = $4,
            updated_at = NOW()
        WHERE sku = $1
        RETURNING *
        `,
        [
            sku,
            changes.product ?? current.product,
            Number(changes.stock ?? current.stock),
            Number(changes.reserved ?? current.reserved)
        ]
    );

    return mapItem(result.rows[0]);
}

async function reserveAtomic(sku, quantity, reservationId) {
    return transaction(async client => {
        const result = await client.query(
            `
            UPDATE inventory
            SET
                reserved = reserved + $2,
                updated_at = NOW()
            WHERE sku = $1
              AND stock - reserved >= $2
            RETURNING *
            `,
            [sku, quantity]
        );

        if (result.rowCount !== 1) {
            throw new Error(
                `Estoque insuficiente para o SKU ${sku}.`
            );
        }

        await client.query(
            `
            INSERT INTO inventory_reservations (
                reservation_id,
                sku,
                quantity,
                status
            )
            VALUES ($1, $2, $3, 'reserved')
            `,
            [reservationId, sku, quantity]
        );

        return mapItem(result.rows[0]);
    });
}

async function releaseAtomic(reservationId) {
    return transaction(async client => {
        const reservation = await client.query(
            `
            SELECT *
            FROM inventory_reservations
            WHERE reservation_id = $1
            FOR UPDATE
            `,
            [reservationId]
        );

        if (reservation.rowCount !== 1) {
            return null;
        }

        const row = reservation.rows[0];

        if (row.status !== 'reserved') {
            return mapReservation(row);
        }

        await client.query(
            `
            UPDATE inventory
            SET
                reserved = GREATEST(reserved - $2, 0),
                updated_at = NOW()
            WHERE sku = $1
            `,
            [row.sku, row.quantity]
        );

        const updated = await client.query(
            `
            UPDATE inventory_reservations
            SET
                status = 'released',
                updated_at = NOW()
            WHERE reservation_id = $1
            RETURNING *
            `,
            [reservationId]
        );

        return mapReservation(updated.rows[0]);
    });
}

async function commitAtomic(reservationId) {
    return transaction(async client => {
        const reservation = await client.query(
            `
            SELECT *
            FROM inventory_reservations
            WHERE reservation_id = $1
            FOR UPDATE
            `,
            [reservationId]
        );

        if (reservation.rowCount !== 1) {
            return null;
        }

        const row = reservation.rows[0];

        if (row.status !== 'reserved') {
            return mapReservation(row);
        }

        await client.query(
            `
            UPDATE inventory
            SET
                stock = stock - $2,
                reserved = GREATEST(reserved - $2, 0),
                updated_at = NOW()
            WHERE sku = $1
              AND stock >= $2
              AND reserved >= $2
            `,
            [row.sku, row.quantity]
        );

        const updated = await client.query(
            `
            UPDATE inventory_reservations
            SET
                status = 'committed',
                updated_at = NOW()
            WHERE reservation_id = $1
            RETURNING *
            `,
            [reservationId]
        );

        return mapReservation(updated.rows[0]);
    });
}

module.exports = {
    getItem,
    getAllItems,
    saveItem,
    updateItem,
    reserveAtomic,
    releaseAtomic,
    commitAtomic
};
