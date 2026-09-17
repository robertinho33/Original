'use strict';

const crypto = require('crypto');
const { transaction } = require('./postgres');

function calculateHash(event) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(event))
        .digest('hex');
}

async function appendEvent({
    eventId,
    eventType,
    orderNumber = null,
    payload = {}
}) {
    return transaction(async client => {
        const previousResult = await client.query(
            `
            SELECT event_hash
            FROM audit_events
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            `
        );

        const previousHash =
            previousResult.rows[0]?.event_hash || null;

        const baseEvent = {
            eventId,
            eventType,
            orderNumber,
            payload,
            previousHash
        };

        const eventHash = calculateHash(baseEvent);

        const result = await client.query(
            `
            INSERT INTO audit_events (
                event_id,
                event_type,
                order_number,
                payload,
                previous_hash,
                event_hash
            )
            VALUES (
                $1,
                $2,
                $3,
                $4::jsonb,
                $5,
                $6
            )
            RETURNING *
            `,
            [
                eventId,
                eventType,
                orderNumber,
                JSON.stringify(payload),
                previousHash,
                eventHash
            ]
        );

        return result.rows[0];
    });
}

async function listEvents({
    limit = 100,
    offset = 0
} = {}) {
    const result = await require('./postgres').query(
        `
        SELECT *
        FROM audit_events
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2
        `,
        [
            Math.min(Math.max(Number(limit) || 100, 1), 500),
            Math.max(Number(offset) || 0, 0)
        ]
    );

    return result.rows;
}

module.exports = {
    appendEvent,
    listEvents
};
