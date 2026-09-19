const { query, transaction } =
    require("./admin-db");

async function setCouponActive(id, active) {
    return transaction(async client => {
        const result = await client.query(
            `
            UPDATE coupons
            SET
                active = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [id, Boolean(active)]
        );

        if (!result.rows[0]) {
            throw new Error("Cupom não encontrado.");
        }

        await client.query(
            `
            INSERT INTO audit_logs
            (action, entity_type, entity_id, details)
            VALUES ('status','coupon',$1,$2)
            `,
            [
                id,
                JSON.stringify({ active: Boolean(active) })
            ]
        );

        return result.rows[0];
    });
}

module.exports = {
    setCouponActive
};
