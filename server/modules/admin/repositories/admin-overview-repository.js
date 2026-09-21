"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const ORDERS = "orders";
const PRODUCTS = "products";
const TRACKING = "orderTracking";

function db() {
    return getFirestore();
}

async function getCollection(name) {
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
    return Number.isFinite(number) ? number : 0;
}

function toDate(value) {
    if (!value) return null;

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function startOfDay(date) {
    const result = new Date(date);

    result.setHours(0, 0, 0, 0);

    return result;
}

async function getAdminOverview() {
    const [orders, products, tracking] =
        await Promise.all([
            getCollection(ORDERS),
            getCollection(PRODUCTS),
            getCollection(TRACKING)
        ]);

    const today = startOfDay(new Date());

    const todayOrders = orders.filter(order => {
        const date = toDate(order.createdAt);

        return date &&
            startOfDay(date).getTime() === today.getTime();
    });

    const revenueToday = todayOrders.reduce(
        (sum, order) =>
            sum + money(order.total),
        0
    );

    const pendingPayments = orders.filter(order => {
        const status =
            order.payment?.status ||
            order.paymentStatus ||
            "pending";

        return String(status).toLowerCase() === "pending";
    });

    const pendingShipments = orders.filter(order => {
        const status =
            order.logistics?.status ||
            order.logisticsStatus ||
            "new";

        return ![
            "delivered",
            "completed"
        ].includes(
            String(status).toLowerCase()
        );
    });

    return {
        faturamentoHoje: revenueToday,
        pedidosHoje: todayOrders.length,
        pedidosTotal: orders.length,
        produtos: products.length,

        estoqueBaixo: products.filter(product => {
            const stock = Number(
                product.stock ??
                product.estoque ??
                0
            );

            return stock > 0 && stock <= 5;
        }).length,

        semEstoque: products.filter(product => {
            const stock = Number(
                product.stock ??
                product.estoque ??
                0
            );

            return stock <= 0;
        }).length,

        pagamentosPendentes:
            pendingPayments.length,

        enviosPendentes:
            pendingShipments.length,

        vendasRecentes: orders
            .sort((a, b) => {
                const da =
                    toDate(a.createdAt)?.getTime() || 0;

                const db =
                    toDate(b.createdAt)?.getTime() || 0;

                return db - da;
            })
            .slice(0, 10)
    };
}

async function getSalesTimeline(days = 30) {
    const orders = await getCollection(ORDERS);

    const now = new Date();

    const start = new Date(now);

    start.setDate(
        start.getDate() - Number(days)
    );

    start.setHours(0, 0, 0, 0);

    const timeline = {};

    for (const order of orders) {
        const date = toDate(order.createdAt);

        if (!date || date < start) {
            continue;
        }

        const key =
            date.toISOString().slice(0, 10);

        if (!timeline[key]) {
            timeline[key] = {
                date: key,
                orders: 0,
                revenue: 0
            };
        }

        timeline[key].orders += 1;
        timeline[key].revenue +=
            money(order.total);
    }

    return Object.values(timeline)
        .sort((a, b) =>
            a.date.localeCompare(b.date)
        );
}

async function getOperationalAlerts() {
    const [orders, products, tracking] =
        await Promise.all([
            getCollection(ORDERS),
            getCollection(PRODUCTS),
            getCollection(TRACKING)
        ]);

    const alerts = [];

    const lowStock = products.filter(product => {
        const stock = Number(
            product.stock ??
            product.estoque ??
            0
        );

        return stock >= 0 && stock <= 5;
    });

    if (lowStock.length > 0) {
        alerts.push({
            type: "stock",
            severity: "warning",
            count: lowStock.length,
            message:
                `${lowStock.length} produto(s) com estoque baixo.`
        });
    }

    const pendingPayments = orders.filter(order => {
        const status =
            order.payment?.status ||
            order.paymentStatus ||
            "pending";

        return String(status).toLowerCase() === "pending";
    });

    if (pendingPayments.length > 0) {
        alerts.push({
            type: "payment",
            severity: "warning",
            count: pendingPayments.length,
            message:
                `${pendingPayments.length} pagamento(s) pendente(s).`
        });
    }

    const pendingShipping = tracking.filter(item => {
        const status =
            item.status ||
            item.logisticsStatus ||
            "";

        return ![
            "delivered",
            "completed"
        ].includes(
            String(status).toLowerCase()
        );
    });

    if (pendingShipping.length > 0) {
        alerts.push({
            type: "shipping",
            severity: "info",
            count: pendingShipping.length,
            message:
                `${pendingShipping.length} envio(s) em aberto.`
        });
    }

    return alerts;
}

module.exports = {
    getAdminOverview,
    getSalesTimeline,
    getOperationalAlerts
};
