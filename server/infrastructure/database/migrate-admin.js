const fs = require("fs");
const path = require("path");

function findPg() {
    const candidates = [
        process.env.DATABASE_URL,
        process.env.POSTGRES_URL,
        process.env.POSTGRESQL_URL
    ];

    return candidates.find(Boolean);
}

async function migrate() {
    const connectionString = findPg();

    if (!connectionString) {
        console.log("[DB] DATABASE_URL não configurada.");
        console.log("[DB] Migração criada e pronta para execução.");
        return;
    }

    let pg;

    try {
        pg = require("pg");
    } catch {
        throw new Error(
            "Dependência 'pg' não encontrada."
        );
    }

    const client = new pg.Client({
        connectionString,
        ssl: process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined
    });

    await client.connect();

    const migrationPath = path.join(
        __dirname,
        "migrations",
        "001-aurea-admin-consolidation.sql"
    );

    const sql = fs.readFileSync(
        migrationPath,
        "utf8"
    );

    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");

        console.log(
            "[DB] AUREA — banco administrativo consolidado."
        );
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}

migrate().catch(error => {
    console.error(
        "[DB] Falha na consolidação:",
        error.message
    );

    process.exitCode = 1;
});
