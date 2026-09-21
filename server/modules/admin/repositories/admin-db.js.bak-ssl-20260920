const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL não configurada.");
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});

pool.on("error", error => {
    console.error("[ADMIN DB] Erro no pool:", error.message);
});

async function query(text, params = []) {
    const client = await pool.connect();

    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

async function close() {
    await pool.end();
}

module.exports = {
    pool,
    query,
    close
};
