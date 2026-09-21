const { Pool } = require("pg");

let pool = null;

function getDatabaseUrl() {
    return (
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.POSTGRESQL_URL ||
        ""
    ).trim();
}

function getPool() {
    if (pool) return pool;

    const connectionString = getDatabaseUrl();

    if (!connectionString) {
        throw new Error("DATABASE_URL não configurada.");
    }

    pool = new Pool({
        connectionString,

        // Render PostgreSQL exige TLS.
        ssl: {
            rejectUnauthorized: false
        },

        max: 5,
        min: 0,

        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,

        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,

        application_name: "aurea-admin"
    });

    pool.on("error", (error) => {
        console.error("[DB] Erro inesperado no pool:", error.message);
    });

    return pool;
}

async function query(text, params = []) {
    const database = getPool();

    try {
        return await database.query(text, params);
    } catch (error) {
        console.error("[DB] Query:", error.message);
        throw error;
    }
}

async function transaction(callback) {
    const database = getPool();
    const client = await database.connect();

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

async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = {
    getPool,
    query,
    transaction,
    closePool
};
