const db = require("../repositories/admin-db");
const {
    getCompatibility
} = require("../repositories/admin-schema");

function emptyDashboard() {
    
        return {
        metrics: {
            revenue: 0,
            orders: 0,
            customers: 0,
            averageTicket: 0
        },
        sales: [],
        recentOrders: [],
        lowStock: [],
        pendingPayments: [],
        ordersToShip: [],
        reservations: [],
        coupons: []
    };
}

function quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

function moneyExpression(column) {
    if (!column) {
        return "0::numeric";
    }

    return `
        COALESCE(
            SUM(
                CASE
                    WHEN ${quoteIdentifier(column)} IS NULL THEN 0
                    ELSE ${quoteIdentifier(column)}::numeric
                END
            ),
            0
        )
    `;
}

async function getDashboard() {
    const compatibility = await getCompatibility();

    const result = emptyDashboard();

    const orders = compatibility.orders;
    const products = compatibility.products;
    const customers = compatibility.customers;
    const payments = compatibility.payments;
    const shipments = compatibility.shipments;

    // --------------------------------------------------------
    // PEDIDOS / FATURAMENTO
    // --------------------------------------------------------

    if (orders.table && orders.id) {

        const totalExpression = orders.total
            ? `COALESCE(${quoteIdentifier(orders.total)}::numeric, 0)`
            : "0::numeric";

        const countResult = await db.query(`
            SELECT COUNT(*)::integer AS total
            FROM "orders"
        `);

        result.metrics.orders =
            Number(countResult.rows[0]?.total || 0);

        if (orders.total) {

            const revenueResult = await db.query(`
                SELECT
                    COALESCE(
                        SUM(${quoteIdentifier(orders.total)}::numeric),
                        0
                    ) AS revenue
                FROM "orders"
            `);

            result.metrics.revenue =
                Number(revenueResult.rows[0]?.revenue || 0);

            result.metrics.averageTicket =
                result.metrics.orders > 0
                    ? result.metrics.revenue /
                        result.metrics.orders
                    : 0;
        }

        if (orders.createdAt) {

            const salesResult = await db.query(`
                SELECT
                    DATE_TRUNC(
                        'day',
                        ${quoteIdentifier(orders.createdAt)}
                    ) AS day,
                    COUNT(*)::integer AS orders
                    ${
                        orders.total
                            ? `,
                    COALESCE(
                        SUM(${quoteIdentifier(orders.total)}::numeric),
                        0
                    ) AS revenue`
                            : `,
                    0::numeric AS revenue`
                    }
                FROM "orders"
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT 30
            `);

            result.sales = salesResult.rows.reverse();
        }

        const recentColumns = [
            orders.id
                ? `${quoteIdentifier(orders.id)} AS id`
                : "NULL AS id",

            orders.number
                ? `${quoteIdentifier(orders.number)} AS order_number`
                : "NULL AS order_number",

            orders.total
                ? `${quoteIdentifier(orders.total)} AS total`
                : "0 AS total",

            orders.status
                ? `${quoteIdentifier(orders.status)} AS status`
                : "NULL AS status",

            orders.createdAt
                ? `${quoteIdentifier(orders.createdAt)} AS created_at`
                : "NULL AS created_at"
        ];

        const recentResult = await db.query(`
            SELECT
                ${recentColumns.join(",\n                ")}
            FROM "orders"
            ORDER BY
                ${
                    orders.createdAt
                        ? `${quoteIdentifier(orders.createdAt)} DESC`
                        : `${quoteIdentifier(orders.id)} DESC`
                }
            LIMIT 10
        `);

        result.recentOrders = recentResult.rows;

        if (orders.paymentStatus) {

            const pendingPaymentsResult = await db.query(`
                SELECT
                    ${recentColumns.join(",\n                    ")}
                FROM "orders"
                WHERE LOWER(COALESCE(payment_status::text, status::text, '')) IN ('pending', 'aguardando', 'pendente')
            ORDER BY
                    ${
                        orders.createdAt
                            ? `${quoteIdentifier(orders.createdAt)} DESC`
                            : `${quoteIdentifier(orders.id)} DESC`
                    }
                LIMIT 20
            `);

            result.pendingPayments = pendingPaymentsResult.rows.filter(row => ['pending', 'aguardando', 'pendente'].includes(String(row.payment_status || row.status || '').toLowerCase()));
        }
    }

    // --------------------------------------------------------
    // CLIENTES
    // --------------------------------------------------------

    if (customers.table && customers.id) {

        const customersResult = await db.query(`
            SELECT COUNT(*)::integer AS total
            FROM "customers"
        `);

        result.metrics.customers =
            Number(customersResult.rows[0]?.total || 0);
    }

    // --------------------------------------------------------
    // PRODUTOS / ESTOQUE
    // --------------------------------------------------------

    if (
        products.table &&
        products.id &&
        products.stock
    ) {

        const productColumns = [
            `${quoteIdentifier(products.id)} AS id`,

            products.sku
                ? `${quoteIdentifier(products.sku)} AS sku`
                : "NULL AS sku",

            products.name
                ? `${quoteIdentifier(products.name)} AS name`
                : "NULL AS name",

            `${quoteIdentifier(products.stock)} AS stock`
        ];

        if (products.price) {
            productColumns.push(
                `${quoteIdentifier(products.price)} AS price`
            );
        }

        const lowStockResult = await db.query(`
            SELECT
                ${productColumns.join(",\n                ")}
            FROM "products"
            WHERE COALESCE(
                ${quoteIdentifier(products.stock)}::numeric,
                0
            ) <= 5
            ORDER BY
                ${quoteIdentifier(products.stock)} ASC
            LIMIT 20
        `);

        result.lowStock = lowStockResult.rows;
    }

    // --------------------------------------------------------
    // LOGÍSTICA
    // --------------------------------------------------------

    if (
        shipments.table &&
        shipments.id
    ) {

        const shipmentColumns = [
            `${quoteIdentifier(shipments.id)} AS id`
        ];

        if (shipments.status) {
            shipmentColumns.push(
                `${quoteIdentifier(shipments.status)} AS status`
            );
        }

        const shipmentResult = await db.query(`
            SELECT
                ${shipmentColumns.join(",\n                ")}
            FROM "shipments"
            ${
                shipments.status
                    ? `
            WHERE LOWER(
                COALESCE(
                    ${quoteIdentifier(shipments.status)}::text,
                    ''
                )
            ) IN (
                'pending',
                'processing',
                'ready',
                'awaiting_shipment',
                'to_ship'
            )
            `
                    : ""
            }
            ORDER BY
                ${quoteIdentifier(shipments.id)} DESC
            LIMIT 20
        `);

        result.ordersToShip =
            shipmentResult.rows;
    }

    // --------------------------------------------------------
    // RESERVAS
    // --------------------------------------------------------

    const schema = compatibility.schema;

    if (Array.isArray(schema.inventory_reservations)) {

        const reservationColumns =
            schema.inventory_reservations;

        const reservationId =
            reservationColumns.includes("id")
                ? "id"
                : null;

        if (reservationId) {

            const reservationResult = await db.query(`
                SELECT *
                FROM "inventory_reservations"
                ORDER BY "id" DESC
                LIMIT 20
            `);

            result.reservations =
                reservationResult.rows;
        }
    }

    // --------------------------------------------------------
    // CUPONS
    // --------------------------------------------------------

    if (Array.isArray(schema.coupons)) {

        const couponColumns =
            schema.coupons;

        const couponId =
            couponColumns.includes("id")
                ? "id"
                : null;

        if (couponId) {

            const couponResult = await db.query(`
                SELECT *
                FROM "coupons"
                ORDER BY "id" DESC
                LIMIT 20
            `);

            result.coupons =
                couponResult.rows;
        }
    }

    return result;
}

async function safeTableQuery(table, sql, params = []) {

    const compatibility =
        await getCompatibility();

    if (!compatibility.schema[table]) {
        return [];
    }

    const result =
        await db.query(sql, params);

    return result.rows;
}

async function getOrders() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.orders.table) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "orders"
            ORDER BY
                ${
                    compatibility.orders.createdAt
                        ? `"${compatibility.orders.createdAt}" DESC`
                        : `"${compatibility.orders.id}" DESC`
                }
            LIMIT 100
        `);

    return result.rows;
}

async function getProducts() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.products.table) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "products"
            ORDER BY
                ${
                    compatibility.products.name
                        ? `"${compatibility.products.name}"`
                        : `"${compatibility.products.id}"`
                }
        `);

    return result.rows;
}

async function getCategories() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.schema.categories) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "categories"
            ORDER BY "id"
        `);

    return result.rows;
}

async function getInventory() {

    const compatibility =
        await getCompatibility();

    if (compatibility.products.table) {

        const result =
            await db.query(`
                SELECT *
                FROM "products"
                ORDER BY
                    ${
                        compatibility.products.stock
                            ? `"${compatibility.products.stock}"`
                            : `"${compatibility.products.id}"`
                    }
            `);

        return result.rows;
    }

    return [];
}

async function getCustomers() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.customers.table) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "customers"
            ORDER BY "id" DESC
            LIMIT 100
        `);

    return result.rows;
}

async function getFinance() {

    const dashboard =
        await getDashboard();

    return {
        revenue: dashboard.metrics.revenue,
        orders: dashboard.metrics.orders,
        averageTicket: dashboard.metrics.averageTicket
    };
}

async function getCoupons() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.schema.coupons) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "coupons"
            ORDER BY "id" DESC
            LIMIT 100
        `);

    return result.rows;
}

async function getLogistics() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.shipments.table) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "shipments"
            ORDER BY
                "${compatibility.shipments.id}" DESC
            LIMIT 100
        `);

    return result.rows;
}

async function getReports() {

    const dashboard =
        await getDashboard();

    return {
        sales: dashboard.sales,
        metrics: dashboard.metrics,
        recentOrders: dashboard.recentOrders
    };
}

async function getAudit() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.schema.audit_logs) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "audit_logs"
            ORDER BY "id" DESC
            LIMIT 100
        `);

    return result.rows;
}

async function getSettings() {

    const compatibility =
        await getCompatibility();

    if (!compatibility.schema.admin_settings) {
        return [];
    }

    const result =
        await db.query(`
            SELECT *
            FROM "admin_settings"
            ORDER BY "id"
        `);

    return result.rows;
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
