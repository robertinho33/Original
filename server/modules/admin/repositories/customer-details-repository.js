const { query } = require("./admin-db");

async function getCustomerDetails(id) {
    const customer = await query(
        `
        SELECT *
        FROM customers
        WHERE id = $1
        `,
        [id]
    );

    if (!customer.rows[0]) {
        return null;
    }

    const orders = await query(
        `
        SELECT
            id,
            order_number,
            status,
            total,
            created_at
        FROM orders
        WHERE customer_id = $1
        ORDER BY created_at DESC
        `,
        [id]
    );

    const addresses = await query(
        `
        SELECT *
        FROM customer_addresses
        WHERE customer_id = $1
        ORDER BY id DESC
        `,
        [id]
    );

    return {
        customer: customer.rows[0],
        orders: orders.rows,
        addresses: addresses.rows
    };
}

module.exports = {
    getCustomerDetails
};
