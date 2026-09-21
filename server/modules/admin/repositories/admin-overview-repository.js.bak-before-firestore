const { query } = require("./admin-db");

async function getAdminOverview() {
    const [
        sales,
        orders,
        customers,
        products,
        inventory,
        payments,
        shipping,
        coupons
    ] = await Promise.all([
        query(`
            SELECT
                COALESCE(SUM(total), 0) AS revenue,
                COUNT(*) AS orders
            FROM orders
            WHERE created_at >= CURRENT_DATE
        `),

        query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status IN ('pending','awaiting_payment')) AS pending,
                COUNT(*) FILTER (WHERE status IN ('processing','paid')) AS processing,
                COUNT(*) FILTER (WHERE status IN ('shipped','in_transit')) AS shipping
            FROM orders
        `),

        query(`
            SELECT COUNT(*) AS total
            FROM customers
        `),

        query(`
            SELECT COUNT(*) AS total
            FROM products
        `),

        query(`
            SELECT
                COUNT(*) FILTER (WHERE stock <= 0) AS out_of_stock,
                COUNT(*) FILTER (WHERE stock > 0 AND stock <= 5) AS low_stock,
                COALESCE(SUM(stock), 0) AS units
            FROM products
        `),

        query(`
            SELECT
                COUNT(*) FILTER (WHERE status IN ('pending','awaiting_payment')) AS pending,
                COALESCE(SUM(amount) FILTER (
                    WHERE status IN ('pending','awaiting_payment')
                ), 0) AS pending_amount
            FROM payments
        `),

        query(`
            SELECT COUNT(*) AS pending
            FROM shipments
            WHERE status IN ('pending','processing','ready_to_ship')
        `),

        query(`
            SELECT COUNT(*) AS active
            FROM coupons
            WHERE active = TRUE
        `)
    ]);

    return {
        revenue: Number(sales.rows[0]?.revenue || 0),
        ordersToday: Number(sales.rows[0]?.orders || 0),
        orders: orders.rows[0],
        customers: Number(customers.rows[0]?.total || 0),
        products: Number(products.rows[0]?.total || 0),
        inventory: inventory.rows[0],
        payments: payments.rows[0],
        shipping: Number(shipping.rows[0]?.pending || 0),
        coupons: Number(coupons.rows[0]?.active || 0)
    };
}

async function getSalesTimeline(days = 30) {
    const result = await query(`
        SELECT
            DATE(created_at) AS day,
            COUNT(*) AS orders,
            COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE - ($1::INTEGER - 1)
        GROUP BY DATE(created_at)
        ORDER BY day
    `, [days]);

    return result.rows;
}

async function getOperationalAlerts() {
    const result = await query(`
        SELECT *
        FROM (
            SELECT
                'stock' AS type,
                'Estoque baixo' AS title,
                COUNT(*)::TEXT || ' produto(s) precisam de reposição' AS message
            FROM products
            WHERE stock > 0 AND stock <= 5

            UNION ALL

            SELECT
                'payment',
                'Pagamentos pendentes',
                COUNT(*)::TEXT || ' pagamento(s) aguardando confirmação'
            FROM payments
            WHERE status IN ('pending','awaiting_payment')

            UNION ALL

            SELECT
                'shipping',
                'Pedidos para envio',
                COUNT(*)::TEXT || ' pedido(s) aguardando expedição'
            FROM shipments
            WHERE status IN ('pending','processing','ready_to_ship')
        ) alerts
        WHERE message NOT LIKE '0 %'
    `);

    return result.rows;
}

module.exports = {
    getAdminOverview,
    getSalesTimeline,
    getOperationalAlerts
};
