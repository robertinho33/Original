const { query, transaction } = require("./admin-db");

async function getSettings() {
    const result = await query(
        `
        SELECT key, value, updated_at
        FROM admin_settings
        ORDER BY key
        `
    );

    return result.rows;
}

async function updateSettings(data) {
    return transaction(async client => {
        for (const [key, value] of Object.entries(data || {})) {
            await client.query(
                `
                INSERT INTO admin_settings (key, value)
                VALUES ($1, $2::jsonb)
                ON CONFLICT (key)
                DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()
                `,
                [key, JSON.stringify(value)]
            );
        }

        await client.query(
            `
            INSERT INTO audit_logs
            (action, entity_type, details)
            VALUES ('update','admin_settings',$1)
            `,
            [JSON.stringify(data)]
        );

        return getSettingsFromClient(client);
    });
}

async function getSettingsFromClient(client) {
    const result = await client.query(
        `
        SELECT key, value, updated_at
        FROM admin_settings
        ORDER BY key
        `
    );

    return result.rows;
}

module.exports = {
    getSettings,
    updateSettings
};
