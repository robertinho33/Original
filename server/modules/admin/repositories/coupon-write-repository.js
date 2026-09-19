const { transaction } = require("./admin-db");

async function createCoupon(data) {

    return transaction(async client => {

        const result = await client.query(
            `
            INSERT INTO coupons
                (
                    code,
                    discount_type,
                    discount_value,
                    minimum_amount,
                    usage_limit,
                    active,
                    starts_at,
                    expires_at,
                    created_at,
                    updated_at
                )
            VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    COALESCE($6, TRUE),
                    $7,
                    $8,
                    NOW(),
                    NOW()
                )
            RETURNING *
            `,
            [
                data.code,
                data.discountType,
                data.discountValue,
                data.minimumAmount ?? 0,
                data.usageLimit ?? null,
                data.active,
                data.startsAt ?? null,
                data.expiresAt ?? null
            ]
        );

        const coupon = result.rows[0];

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('CREATE', 'coupon', $1, $2::jsonb, NOW())
            `,
            [
                coupon.id,
                JSON.stringify({
                    source: "admin",
                    code: coupon.code
                })
            ]
        );

        return coupon;
    });
}

async function updateCoupon(id, data) {

    return transaction(async client => {

        const result = await client.query(
            `
            UPDATE coupons
               SET code = COALESCE($2, code),
                   discount_type =
                       COALESCE($3, discount_type),
                   discount_value =
                       COALESCE($4, discount_value),
                   minimum_amount =
                       COALESCE($5, minimum_amount),
                   usage_limit =
                       COALESCE($6, usage_limit),
                   active =
                       COALESCE($7, active),
                   starts_at =
                       COALESCE($8, starts_at),
                   expires_at =
                       COALESCE($9, expires_at),
                   updated_at = NOW()
             WHERE id = $1
         RETURNING *
            `,
            [
                id,
                data.code ?? null,
                data.discountType ?? null,
                data.discountValue ?? null,
                data.minimumAmount ?? null,
                data.usageLimit ?? null,
                data.active ?? null,
                data.startsAt ?? null,
                data.expiresAt ?? null
            ]
        );

        if (!result.rows.length) {
            throw new Error(
                "Cupom não encontrado."
            );
        }

        await client.query(
            `
            INSERT INTO audit_logs
                (action, entity_type, entity_id, metadata, created_at)
            VALUES
                ('UPDATE', 'coupon', $1, $2::jsonb, NOW())
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
    createCoupon,
    updateCoupon
};
