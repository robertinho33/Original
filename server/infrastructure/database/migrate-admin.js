require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATABASE_URL = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    ""
).trim();

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000
});

async function main() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const migrationPath = path.join(
            __dirname,
            "migrations",
            "007-admin-database-consolidation.sql"
        );

        let sql = fs.readFileSync(migrationPath, "utf8");

        // Remove BOM UTF-8.
        sql = sql.replace(/^\uFEFF/, "");

        console.log("[DB] Executando 007-admin-database-consolidation.sql");

        await client.query(sql);

        await client.query("COMMIT");

        console.log("[DB] OK: consolidação PostgreSQL concluída.");
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        console.error("[DB] FALHA:", error.message);

        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(() => {
    process.exitCode = 1;
});