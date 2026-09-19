const db = require("../repositories/admin-db");

let schemaCache = null;

async function loadSchema() {
    if (schemaCache) {
        return schemaCache;
    }

    const result = await db.query(`
        SELECT
            table_name,
            column_name,
            data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    `);

    schemaCache = {};

    for (const row of result.rows) {
        if (!schemaCache[row.table_name]) {
            schemaCache[row.table_name] = [];
        }

        schemaCache[row.table_name].push(row.column_name);
    }

    return schemaCache;
}

function hasTable(schema, table) {
    return Array.isArray(schema[table]);
}

function hasColumn(schema, table, column) {
    return hasTable(schema, table) &&
        schema[table].includes(column);
}

function firstExisting(schema, table, candidates) {
    if (!hasTable(schema, table)) {
        return null;
    }

    return candidates.find(column =>
        schema[table].includes(column)
    ) || null;
}

async function getCompatibility() {
    const schema = await loadSchema();

    return {
        schema,

        orders: {
            table: hasTable(schema, "orders"),
            id: firstExisting(schema, "orders", [
                "id",
                "order_id",
                "uuid"
            ]),
            number: firstExisting(schema, "orders", [
                "order_number",
                "number",
                "code",
                "order_code"
            ]),
            total: firstExisting(schema, "orders", [
                "total",
                "total_price",
                "amount",
                "grand_total",
                "total_value"
            ]),
            status: firstExisting(schema, "orders", [
                "status",
                "order_status"
            ]),
            paymentStatus: firstExisting(schema, "orders", [
                "payment_status",
                "payment_state"
            ]),
            customerId: firstExisting(schema, "orders", [
                "customer_id",
                "client_id"
            ]),
            createdAt: firstExisting(schema, "orders", [
                "created_at",
                "createdAt",
                "date",
                "order_date"
            ])
        },

        products: {
            table: hasTable(schema, "products"),
            id: firstExisting(schema, "products", [
                "id",
                "product_id"
            ]),
            sku: firstExisting(schema, "products", [
                "sku",
                "code"
            ]),
            name: firstExisting(schema, "products", [
                "name",
                "product_name",
                "title"
            ]),
            price: firstExisting(schema, "products", [
                "price",
                "unit_price",
                "sale_price"
            ]),
            stock: firstExisting(schema, "products", [
                "stock",
                "stock_quantity",
                "quantity",
                "inventory"
            ]),
            active: firstExisting(schema, "products", [
                "active",
                "is_active",
                "enabled"
            ])
        },

        customers: {
            table: hasTable(schema, "customers"),
            id: firstExisting(schema, "customers", [
                "id",
                "customer_id"
            ])
        },

        payments: {
            table: hasTable(schema, "payments"),
            amount: firstExisting(schema, "payments", [
                "amount",
                "value",
                "total"
            ]),
            status: firstExisting(schema, "payments", [
                "status",
                "payment_status"
            ])
        },

        shipments: {
            table: hasTable(schema, "shipments"),
            id: firstExisting(schema, "shipments", [
                "id",
                "shipment_id"
            ]),
            status: firstExisting(schema, "shipments", [
                "status",
                "shipping_status"
            ])
        },

        orderItems: {
            table: hasTable(schema, "order_items"),
            orderId: firstExisting(schema, "order_items", [
                "order_id"
            ]),
            productId: firstExisting(schema, "order_items", [
                "product_id"
            ]),
            quantity: firstExisting(schema, "order_items", [
                "quantity",
                "qty"
            ]),
            price: firstExisting(schema, "order_items", [
                "unit_price",
                "price",
                "amount"
            ])
        }
    };
}

function clearSchemaCache() {
    schemaCache = null;
}

module.exports = {
    loadSchema,
    getCompatibility,
    hasTable,
    hasColumn,
    firstExisting,
    clearSchemaCache
};
