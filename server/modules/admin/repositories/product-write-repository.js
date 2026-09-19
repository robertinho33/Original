const { query, transaction } = require("./admin-db");

async function createProduct(data) {
    return transaction(async client => {
        const result = await client.query(
            `
            INSERT INTO products
            (
                sku,
                name,
                description,
                price,
                stock,
                category_id,
                image_url,
                active
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            `,
            [
                data.sku,
                data.name,
                data.description || null,
                Number(data.price || 0),
                Number(data.stock || 0),
                data.category_id || null,
                data.image_url || null,
                data.active !== false
            ]
        );

        await client.query(
            `
            INSERT INTO audit_logs
            (action, entity_type, entity_id, details)
            VALUES ('create','product',$1,$2)
            `,
            [
                result.rows[0].id,
                JSON.stringify({ sku: data.sku })
            ]
        );

        return result.rows[0];
    });
}

async function updateProduct(id, data) {
    return transaction(async client => {
        const result = await client.query(
            `
            UPDATE products
            SET
                sku = COALESCE($2, sku),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                price = COALESCE($5, price),
                stock = COALESCE($6, stock),
                category_id = COALESCE($7, category_id),
                image_url = COALESCE($8, image_url),
                active = COALESCE($9, active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [
                id,
                data.sku ?? null,
                data.name ?? null,
                data.description ?? null,
                data.price !== undefined ? Number(data.price) : null,
                data.stock !== undefined ? Number(data.stock) : null,
                data.category_id ?? null,
                data.image_url ?? null,
                data.active !== undefined ? Boolean(data.active) : null
            ]
        );

        if (!result.rows[0]) {
            throw new Error("Produto não encontrado.");
        }

        await client.query(
            `
            INSERT INTO audit_logs
            (action, entity_type, entity_id, details)
            VALUES ('update','product',$1,$2)
            `,
            [id, JSON.stringify(data)]
        );

        return result.rows[0];
    });
}

async function getProductDetails(id) {
    const result = await query(
        `
        SELECT
            p.*,
            c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = $1
        `,
        [id]
    );

    return result.rows[0] || null;
}

module.exports = {
    createProduct,
    updateProduct,
    getProductDetails
};
