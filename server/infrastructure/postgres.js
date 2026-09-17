'use strict';

const {
    pool,
    query,
    checkDatabase,
    closeDatabase
} = require('./postgres');

async function transaction(callback) {
    if (!pool) {
        throw new Error('DATABASE_URL não configurada.');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await callback(client);

        await client.query('COMMIT');

        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[DATABASE] Falha no ROLLBACK:', rollbackError);
        }

        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    query,
    transaction,
    checkDatabase,
    closeDatabase
};
