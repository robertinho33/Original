const db = require("../repositories/admin-db");

async function getDashboard() {
    const [
        finance,
        orders,
        customers,
        stock,
        pendingPayments,
        shipping
    ] = await Promise.all([

        db.query(`
            SELECT
                COALESCE(
                    SUM(total_amount)
                    FILTER (
                        WHERE payment_status = 'paid'
                    ),
                    0
                ) AS revenue,

                COUNT(*)
                    FILTER (
                        WHERE payment_status = 'paid'
                    ) AS paid_orders,

                COALESCE(
                    AVG(total_amount)
                    FILTER (
                        WHERE payment_status = 'paid'
                    ),
                    0
                ) AS average_ticket

            FROM orders
        `),

        db.query(`
            SELECT COUNT(*)::INTEGER AS total
            FROM orders
        `),

        db.query(`
            SELECT COUNT(*)::INTEGER AS total
            FROM customers
        `),

        db.query(`
            SELECT COUNT(*)::INTEGER AS total
            FROM admin_product_stock
            WHERE available_quantity <= minimum_stock
              AND active = TRUE
        `),

        db.query(`
            SELECT COUNT(*)::INTEGER AS total
            FROM orders
            WHERE payment_status = 'pending'
        `),

        db.query(`
            SELECT COUNT(*)::INTEGER AS total
            FROM shipments
            WHERE status IN ('pending', 'preparing')
        `)
    ]);

    return {
        revenue: Number(finance[0]?.revenue || 0),
        paidOrders: Number(finance[0]?.paid_orders || 0),
        averageTicket: Number(finance[0]?.average_ticket || 0),
        orders: Number(orders[0]?.total || 0),
        customers: Number(customers[0]?.total || 0),
        lowStock: Number(stock[0]?.total || 0),
        pendingPayments: Number(pendingPayments[0]?.total || 0),
        ordersToShip: Number(shipping[0]?.total || 0)
    };
}

async function getOrders() {
    return db.query(`
        SELECT *
        FROM admin_order_summary
        ORDER BY created_at DESC
        LIMIT 100
    `);
}

async function getProducts() {
    return db.query(`
        SELECT *
        FROM admin_product_stock
        ORDER BY name ASC
    `);
}

async function getCategories() {
    return db.query(`
        SELECT
            c.id,
            c.name,
            c.slug,
            c.active,
            COUNT(p.id)::INTEGER AS product_count
        FROM categories c
        LEFT JOIN products p
            ON p.category_id = c.id
        GROUP BY
            c.id,
            c.name,
            c.slug,
            c.active
        ORDER BY c.name ASC
    `);
}

async function getInventory() {
    return db.query(`
        SELECT *
        FROM admin_product_stock
        ORDER BY
            available_quantity ASC,
            name ASC
    `);
}

async function getCustomers() {
    return db.query(`
        SELECT
            c.id,
            c.name,
            c.email,
            c.phone,
            c.created_at,
            COUNT(o.id)::INTEGER AS order_count,
            COALESCE(
                SUM(o.total_amount),
                0
            ) AS total_spent
        FROM customers c
        LEFT JOIN orders o
            ON o.customer_id = c.id
        GROUP BY
            c.id,
            c.name,
            c.email,
            c.phone,
            c.created_at
        ORDER BY c.created_at DESC
        LIMIT 100
    `);
}

async function getFinance() {
    const rows = await db.query(`
        SELECT
            COUNT(*)::INTEGER AS total_orders,

            COALESCE(
                SUM(total_amount)
                FILTER (
                    WHERE payment_status = 'paid'
                ),
                0
            ) AS revenue,

            COALESCE(
                SUM(total_amount)
                FILTER (
                    WHERE payment_status = 'pending'
                ),
                0
            ) AS pending_revenue,

            COALESCE(
                SUM(discount_amount),
                0
            ) AS discounts,

            COALESCE(
                AVG(total_amount)
                FILTER (
                    WHERE payment_status = 'paid'
                ),
                0
            ) AS average_ticket

        FROM orders
    `);

    return rows[0] || {};
}

async function getCoupons() {
    return db.query(`
        SELECT *
        FROM admin_coupon_summary
        ORDER BY created_at DESC
    `);
}

async function getLogistics() {
    return db.query(`
        SELECT
            s.id,
            o.order_number,
            c.name AS customer_name,
            s.method,
            s.carrier,
            s.tracking_code,
            s.status,
            s.estimated_delivery,
            s.shipped_at,
            s.delivered_at
        FROM shipments s
        INNER JOIN orders o
            ON o.id = s.order_id
        LEFT JOIN customers c
            ON c.id = o.customer_id
        ORDER BY s.created_at DESC
        LIMIT 100
    `);
}

async function getReports() {
    const [
        summary,
        products,
        categories,
        orderStatus
    ] = await Promise.all([

        db.query(`
            SELECT
                COUNT(*)::INTEGER AS orders,

                COALESCE(
                    SUM(total_amount)
                    FILTER (
                        WHERE payment_status = 'paid'
                    ),
                    0
                ) AS revenue,

                COALESCE(
                    AVG(total_amount)
                    FILTER (
                        WHERE payment_status = 'paid'
                    ),
                    0
                ) AS average_ticket
            FROM orders
        `),

        db.query(`
            SELECT
                oi.product_name,
                SUM(oi.quantity)::INTEGER AS quantity,
                SUM(oi.total_price) AS revenue
            FROM order_items oi
            INNER JOIN orders o
                ON o.id = oi.order_id
            WHERE o.payment_status = 'paid'
            GROUP BY oi.product_name
            ORDER BY revenue DESC
            LIMIT 20
        `),

        db.query(`
            SELECT
                COALESCE(c.name, 'Sem categoria') AS category,
                SUM(oi.quantity)::INTEGER AS quantity,
                SUM(oi.total_price) AS revenue
            FROM order_items oi
            INNER JOIN orders o
                ON o.id = oi.order_id
            LEFT JOIN products p
                ON p.id = oi.product_id
            LEFT JOIN categories c
                ON c.id = p.category_id
            WHERE o.payment_status = 'paid'
            GROUP BY c.name
            ORDER BY revenue DESC
        `),

        db.query(`
            SELECT
                status,
                COUNT(*)::INTEGER AS total
            FROM orders
            GROUP BY status
            ORDER BY total DESC
        `)
    ]);

    return {
        summary: summary[0] || {},
        products,
        categories,
        orderStatus
    };
}

async function getAudit() {
    return db.query(`
        SELECT *
        FROM admin_audit_summary
        LIMIT 200
    `);
}

async function getSettings() {
    const rows = await db.query(`
        SELECT
            COUNT(*)::INTEGER AS products,
            (
                SELECT COUNT(*)::INTEGER
                FROM categories
                WHERE active = TRUE
            ) AS categories,
            (
                SELECT COUNT(*)::INTEGER
                FROM customers
            ) AS customers
        FROM products
    `);

    return rows[0] || {};
}

module.exports = {
    getDashboard,
    getOrders,
    getProducts,
    getCategories,
    getInventory,
    getCustomers,
    getFinance,
    getCoupons,
    getLogistics,
    getReports,
    getAudit,
    getSettings
};
