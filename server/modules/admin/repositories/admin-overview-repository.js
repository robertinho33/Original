"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const {
    calculateIndicators,
    buildOperationalAlerts
} = require("../services/firestore-admin-indicators");

const ORDERS = "orders";
const PRODUCTS = "products";
const USERS = "users";
const TRACKING = "orderTracking";

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

async function getAdminOverview() {
    const [
        orders,
        products,
        users,
        tracking
    ] = await Promise.all([
        collection(ORDERS),
        collection(PRODUCTS),
        collection(USERS),
        collection(TRACKING)
    ]);

    const today = new Date();

    const todayOrders = orders.filter(order => {
        const date = dateValue(order.createdAt);

        if (!date) {
            return false;
        }

        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );
    });

    const todayRevenue = todayOrders.reduce(
        (sum, order) => sum + money(order.total),
        0
    );

    const indicators = calculateIndicators({
        orders,
        products,
        tracking
    });

    return {
        faturamentoHoje: todayRevenue,
        pedidosHoje: todayOrders.length,

        clientes: users.length,
        produtos: products.length,

        estoqueBaixo: indicators.estoqueBaixo,
        semEstoque: indicators.semEstoque,

        pagamentosPendentes:
            indicators.pagamentosPendentes,

        enviosPendentes:
            indicators.enviosPendentes
    };
}

async function getOperationalAlerts() {
    const [
        orders,
        products,
        tracking
    ] = await Promise.all([
        collection(ORDERS),
        collection(PRODUCTS),
        collection(TRACKING)
    ]);

    const indicators = calculateIndicators({
        orders,
        products,
        tracking
    });

    return buildOperationalAlerts(indicators);
}

async function getSalesTimeline(days = 30) {
    const orders = await collection(ORDERS);

    const safeDays = Math.min(
        Math.max(Number(days || 30), 1),
        365
    );

    const now = new Date();

    const start = new Date(now);
    start.setDate(start.getDate() - safeDays);

    const grouped = new Map();

    for (const order of orders) {
        const date = dateValue(order.createdAt);

        if (!date || date < start) {
            continue;
        }

        const key = new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "America/Sao_Paulo"
            }
        ).format(date);

        if (!grouped.has(key)) {
            grouped.set(key, {
                date: key,
                orders: 0,
                revenue: 0
            });
        }

        const item = grouped.get(key);

        item.orders += 1;
        item.revenue += money(order.total);
    }

    return Array.from(grouped.values())
        .sort((a, b) =>
            a.date.localeCompare(b.date)
        );
}

module.exports = {
    getAdminOverview,
    getSalesTimeline,
    getOperationalAlerts
};