"use strict";

const { getFirestore } = require("../../../infrastructure/firebase/firebase-admin");

const ORDERS = "orders";
const TRACKING = "orderTracking";
const USERS = "users";

function db() {
    return getFirestore();
}

function money(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value) {
    if (!value) return null;

    if (value.toDate) {
        return value.toDate().toISOString();
    }

    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return null;
}

function normalizeOrder(data, id) {
    return {
        ...data,
        id: data.id || id,
        total: money(data.total),
        createdAt: normalizeDate(data.createdAt),
        updatedAt: normalizeDate(data.updatedAt)
    };
}

async function getCollection(name) {
    const snapshot = await db().collection(name).get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function getOrders() {
    const orders = await getCollection(ORDERS);

    return orders
        .map(order => normalizeOrder(order, order.id))
        .sort((a, b) => {
            const da = new Date(a.createdAt || 0).getTime();
            const db = new Date(b.createdAt || 0).getTime();
            return db - da;
        });
}

async function getProducts() {
    return getCollection("products");
}

async function getCategories() {
    return getCollection("categories");
}

async function getInventory() {
    return getCollection("inventory");
}

async function getCustomers() {
    return getCollection(USERS);
}

async function getFinance() {
    const orders = await getOrders();

    const confirmed = orders.filter(order => {
        const status =
            order.payment?.status ||
            order.paymentStatus ||
            "";

        return [
            "confirmed",
            "paid",
            "approved",
            "completed"
        ].includes(String(status).toLowerCase());
    });

    return {
        totalOrders: orders.length,
        confirmedOrders: confirmed.length,
        grossRevenue: confirmed.reduce(
            (sum, order) => sum + money(order.total),
            0
        )
    };
}

async function getCoupons() {
    return getCollection("coupons");
}

async function getLogistics() {
    const tracking = await getCollection(TRACKING);

    return tracking;
}

async function getReports() {
    const orders = await getOrders();

    return {
        totalOrders: orders.length,
        totalRevenue: orders.reduce(
            (sum, order) => sum + money(order.total),
            0
        )
    };
}

async function getAudit() {
    return getCollection("audit");
}

async function getSettings() {
    return getCollection("settings");
}

async function getDashboard() {
    const [orders, customers, products] = await Promise.all([
        getOrders(),
        getCustomers(),
        getProducts()
    ]);

    const today = new Date();

    const todayOrders = orders.filter(order => {
        if (!order.createdAt) return false;

        const date = new Date(order.createdAt);

        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );
    });

    const revenueToday = todayOrders.reduce(
        (sum, order) => sum + money(order.total),
        0
    );

    const recentOrders = orders.slice(0, 10);

    return {
        faturamentoHoje: revenueToday,
        pedidosHoje: todayOrders.length,
        clientes: customers.length,
        produtos: products.length,

        estoqueBaixo: products.filter(product =>
            Number(product.stock ?? product.estoque ?? 0) > 0 &&
            Number(product.stock ?? product.estoque ?? 0) <= 5
        ).length,

        semEstoque: products.filter(product =>
            Number(product.stock ?? product.estoque ?? 0) <= 0
        ).length,

        pagamentosPendentes: orders.filter(order => {
            const status =
                order.payment?.status ||
                order.paymentStatus ||
                "pending";

            return String(status).toLowerCase() === "pending";
        }).length,

        enviosPendentes: orders.filter(order => {
            const status =
                order.logistics?.status ||
                order.logisticsStatus ||
                "new";

            return ![
                "delivered",
                "completed"
            ].includes(String(status).toLowerCase());
        }).length,

        vendasRecentes: recentOrders
    };
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
