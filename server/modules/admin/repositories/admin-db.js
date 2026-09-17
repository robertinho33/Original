const { Pool } = require("pg");

let pool;

function getPool() {
    if (pool) {
        return pool;
    }

    if (!process.env.DATABASE_URL) {
        throw new Error(
            "DATABASE_URL não configurada."
        );
    }

    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined
    });

    return pool;
}

async function query(text, params = []) {
    const client = await getPool().connect();

    try {
        const result = await client.query(
            text,
            params
        );

        return result.rows;
    } finally {
        client.release();
    }
}

async function transaction(callback) {
    const client = await getPool().connect();

    try {
        await client.query("BEGIN");

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    getPool,
    query,
    transaction
};
