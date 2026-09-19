const { query, transaction } = require("./admin-db");

async function getProductDetails(id) {
    const result = await query(`
        SELECT
            p.*,
            c.name AS category_name,
            COALESCE(s.stock, 0) AS current_stock
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN admin_product_stock s ON s.product_id = p.id
        WHERE p.id = $1
        LIMIT 1
    `, [id]);

    return result.rows[0] || null;
}

async function createProduct(data) {
    return transaction(async (client) => {
        const result = await client.query(`
            INSERT INTO products (
                sku,
                name,
                description,
                price,
                category_id,
                stock,
                image_url,
                active,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                COALESCE($8, TRUE),
                NOW(),
                NOW()
            )
            RETURNING *
        `, [
            data.sku,
            data.name,
            data.description || null,
            Number(data.price || 0),
            data.category_id || null,
            Number(data.stock || 0),
            data.image_url || null,
            data.active
        ]);

        const product = result.rows[0];

        await client.query(`
            INSERT INTO audit_logs (
                action,
                entity_type,
                entity_id,
                details,
                created_at
            )
            VALUES (
                'create',
                'product',
                $1,
                $2::jsonb,
                NOW()
            )
        `, [
            product.id,
            JSON.stringify({
                sku: product.sku,
                name: product.name
            })
        ]);

        return product;
    });
}

async function updateProduct(id, data) {
    return transaction(async (client) => {
        const result = await client.query(`
            UPDATE products
            SET
                sku = COALESCE($2, sku),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                price = COALESCE($5, price),
                category_id = COALESCE($6, category_id),
                image_url = COALESCE($7, image_url),
                active = COALESCE($8, active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [
            id,
            data.sku,
            data.name,
            data.description,
            data.price !== undefined ? Number(data.price) : null,
            data.category_id,
            data.image_url,
            data.active
        ]);

        if (!result.rows[0]) {
            throw new Error("Produto não encontrado.");
        }

        await client.query(`
            INSERT INTO audit_logs (
                action,
                entity_type,
                entity_id,
                details,
                created_at
            )
            VALUES (
                'update',
                'product',
                $1,
                $2::jsonb,
                NOW()
            )
        `, [
            id,
            JSON.stringify(data)
        ]);

        return result.rows[0];
    });
}

module.exports = {
    getProductDetails,
    createProduct,
    updateProduct
};
