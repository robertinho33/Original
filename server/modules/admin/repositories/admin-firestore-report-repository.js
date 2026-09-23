"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const {
    isShipmentOpen,
    isPaymentPending
} = require("../services/firestore-admin-indicators");

const ORDERS = "orders";
const TRACKING = "orderTracking";
const USERS = "users";
const PRODUCTS = "products";
const INVENTORY = "inventory";

function db() {
    return getFirestore();
}

async function collection(name) {
    const snapshot = await db()
        .collection(name)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

function money(value) {
    const number = Number(value || 0);

    return Number.isFinite(number)
        ? number
        : 0;
}

function dateValue(value) {
    if (!value) {
        return null;
    }

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

async function getOrders() {
    const orders = await collection(ORDERS);

    return orders.sort((a, b) => {
        const da =
            dateValue(a.createdAt)?.getTime() || 0;

        const db =
            dateValue(b.createdAt)?.getTime() || 0;

        return db - da;
    });
}

async function getOrder(id) {
    const snapshot = await db()
        .collection(ORDERS)
        .doc(id)
        .get();

    if (!snapshot.exists) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

async function getTracking(id) {
    const snapshot = await db()
        .collection(TRACKING)
        .doc(id)
        .get();

    if (!snapshot.exists) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

async function getCustomers() {
    return collection(USERS);
}

async function getProducts() {
    return collection(PRODUCTS);
}

async function getInventory() {
    return collection(INVENTORY);
}

async function salesReport() {
    const orders = await getOrders();

    const totalRevenue = orders.reduce(
        (sum, order) => sum + money(order.total),
        0
    );

    return {
        totalOrders: orders.length,
        totalRevenue
    };
}

async function productReport() {
    const products = await getProducts();

    return {
        totalProducts: products.length,
        products
    };
}

async function customerReport() {
    const customers = await getCustomers();

    return {
        totalCustomers: customers.length,
        customers
    };
}

async function getOrderHistory(id) {
    const order = await getOrder(id);
    const tracking = await getTracking(id);

    return {
        order,
        tracking,
        history:
            tracking?.history ||
            order?.history ||
            []
    };
}

async function getCustomerCommercialHistory(id) {
    const orders = await getOrders();

    const customerOrders = orders.filter(order =>
        order.customerId === id ||
        order.userId === id ||
        order.customer?.id === id ||
        order.customer?.email === id
    );

    return {
        customerId: id,
        orders: customerOrders,
        totalOrders: customerOrders.length,
        totalRevenue: customerOrders.reduce(
            (sum, order) =>
                sum + money(order.total),
            0
        )
    };
}

async function getInventoryMovements() {
    return getInventory();
}

async function getShippingQueue() {
    const tracking = await collection(TRACKING);

    return tracking.filter(isShipmentOpen);
}

async function getFinancialOverview() {
    const orders = await getOrders();

    return {
        totalOrders: orders.length,

        totalRevenue: orders.reduce(
            (sum, order) =>
                sum + money(order.total),
            0
        ),

        pendingPayments:
            orders.filter(isPaymentPending).length
    };
}

module.exports = {
    salesReport,
    productReport,
    customerReport,
    getOrderHistory,
    getCustomerCommercialHistory,
    getInventoryMovements,
    getShippingQueue,
    getFinancialOverview
};