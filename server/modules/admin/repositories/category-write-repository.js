const { transaction } = require("./admin-db");

async function createCategory(data) {

    return transaction(async client => {

        const result = await client.query(
            `
            INSERT INTO categories
                (name, slug, description, active, created_at, updated_at)
            VALUES
                ($1, $2, $3, COALESCE($4, TRUE), NOW(), NOW())
            RETURNING *
            `,
            [
                data.name,
                data.slug,
                data.description || null,
                data.active
            ]
        );

        const category = result.rows[0];

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('CREATE', 'category', $1, $2::jsonb, NOW())
            `,
            [
                category.id,
                JSON.stringify({
                    source: "admin",
                    name: category.name
                })
            ]
        );

        return category;
    });
}

async function updateCategory(id, data) {

    return transaction(async client => {

        const result = await client.query(
            `
            UPDATE categories
               SET name = COALESCE($2, name),
                   slug = COALESCE($3, slug),
                   description = COALESCE($4, description),
                   active = COALESCE($5, active),
                   updated_at = NOW()
             WHERE id = $1
         RETURNING *
            `,
            [
                id,
                data.name ?? null,
                data.slug ?? null,
                data.description ?? null,
                data.active ?? null
            ]
        );

        if (!result.rows.length) {
            throw new Error(
                "Categoria não encontrada."
            );
        }

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('UPDATE', 'category', $1, $2::jsonb, NOW())
            `,
            [
                id,
                JSON.stringify({
                    source: "admin",
                    fields: Object.keys(data)
                })
            ]
        );

        return result.rows[0];
    });
}

module.exports = {
    createCategory,
    updateCategory
};
