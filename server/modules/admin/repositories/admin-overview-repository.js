"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const {
    buildOperationalAlerts
} = require("../services/firestore-admin-indicators");

const ORDERS = "orders";
const USERS = "users";
const TRACKING = "orderTracking";

const RUNTIME_CATALOG =
    "data/catalog/catalog-runtime.json";

function db() {
    return getFirestore();
}

async function loadRuntimeProducts() {
    const fs = require("fs/promises");
    const path = require("path");

    const filePath = path.resolve(
        process.cwd(),
        RUNTIME_CATALOG
    );

    const content =
        await fs.readFile(
            filePath,
            "utf8"
        );

    const data =
        JSON.parse(content);

    return Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
            ? data.products
            : [];
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

    if (
        typeof value.toDate === "function"
    ) {
        return value.toDate();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

async function productStats() {
    const products =
        await loadRuntimeProducts();

    let semEstoque = 0;
    let estoqueBaixo = 0;

    for (const product of products) {
        const stock =
            Number(product?.stock ?? 0);

        if (!Number.isFinite(stock)) {
            continue;
        }

        if (stock <= 0) {
            semEstoque++;
            continue;
        }

        if (stock <= 5) {
            estoqueBaixo++;
        }
    }

    return {
        produtos: products.length,
        semEstoque,
        estoqueBaixo
    };
}

async function countCustomers() {
    const snapshot =
        await db()
            .collection(USERS)
            .count()
            .get();

    return Number(
        snapshot.data().count || 0
    );
}

async function getTodayOrders() {
    const now = new Date();

    const start =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

    const end =
        new Date(start);

    end.setDate(
        end.getDate() + 1
    );

    const snapshot =
        await db()
            .collection(ORDERS)
            .where(
                "createdAt",
                ">=",
                start
            )
            .where(
                "createdAt",
                "<",
                end
            )
            .get();

    return snapshot.docs.map(
        doc => ({
            id: doc.id,
            ...doc.data()
        })
    );
}

async function countPendingPayments() {
    const snapshot =
        await db()
            .collection(ORDERS)
            .where(
                "payment.status",
                "==",
                "pending"
            )
            .count()
            .get();

    return Number(
        snapshot.data().count || 0
    );
}

async function countOpenShipments() {
    const snapshot =
        await db()
            .collection(TRACKING)
            .where(
                "status",
                "not-in",
                [
                    "delivered",
                    "completed",
                    "cancelled",
                    "canceled"
                ]
            )
            .count()
            .get();

    return Number(
        snapshot.data().count || 0
    );
}

async function getAdminOverview() {
    const [
        todayOrders,
        customers,
        products,
        pagamentosPendentes,
        enviosPendentes
    ] = await Promise.all([
        getTodayOrders(),
        countCustomers(),
        productStats(),
        countPendingPayments(),
        countOpenShipments()
    ]);

    const faturamentoHoje =
        todayOrders.reduce(
            (sum, order) =>
                sum + money(order.total),
            0
        );

    return {
        faturamentoHoje,

        pedidosHoje:
            todayOrders.length,

        clientes:
            customers,

        produtos:
            products.produtos,

        estoqueBaixo:
            products.estoqueBaixo,

        semEstoque:
            products.semEstoque,

        pagamentosPendentes,

        enviosPendentes
    };
}

async function getOperationalAlerts() {
    const [
        products,
        pagamentosPendentes,
        enviosPendentes
    ] = await Promise.all([
        productStats(),
        countPendingPayments(),
        countOpenShipments()
    ]);

    return buildOperationalAlerts({
        produtos:
            products.produtos,

        estoqueBaixo:
            products.estoqueBaixo,

        semEstoque:
            products.semEstoque,

        pagamentosPendentes,

        enviosPendentes
    });
}

async function getSalesTimeline(days = 30) {
    const safeDays =
        Math.min(
            Math.max(
                Number(days || 30),
                1
            ),
            365
        );

    const now =
        new Date();

    const start =
        new Date(now);

    start.setDate(
        start.getDate() - safeDays
    );

    const snapshot =
        await db()
            .collection(ORDERS)
            .where(
                "createdAt",
                ">=",
                start
            )
            .get();

    const grouped =
        new Map();

    for (const doc of snapshot.docs) {
        const order = {
            id: doc.id,
            ...doc.data()
        };

        const date =
            dateValue(order.createdAt);

        if (!date) {
            continue;
        }

        const key =
            new Intl.DateTimeFormat(
                "en-CA",
                {
                    timeZone:
                        "America/Sao_Paulo"
                }
            ).format(date);

        if (!grouped.has(key)) {
            grouped.set(
                key,
                {
                    date: key,
                    orders: 0,
                    revenue: 0
                }
            );
        }

        const item =
            grouped.get(key);

        item.orders += 1;

        item.revenue +=
            money(order.total);
    }

    return Array.from(
        grouped.values()
    ).sort(
        (a, b) =>
            a.date.localeCompare(
                b.date
            )
    );
}

module.exports = {
    getAdminOverview,
    getSalesTimeline,
    getOperationalAlerts
};
