"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const {
    buildOperationalAlerts
} = require("../services/firestore-admin-indicators");

const sales=require('../services/dashboard-sales');
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

async function countCustomers(){return (await require('../services/admin-service').getCustomers()).length;}

async function getTodayOrders() { return sales.ordersBetween(db().collection(ORDERS),sales.range(1)); }

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

async function countOpenShipments() { return sales.pendingShipments(await sales.readPaidOrders(db().collection(ORDERS))); }

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

    const faturamentoHoje = sales.revenue(todayOrders);

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

async function getSalesTimeline(days = 30) { const bounds=sales.range(days); return sales.timeline(await sales.ordersBetween(db().collection(ORDERS),bounds),bounds); }

module.exports = {
    getAdminOverview,
    getSalesTimeline,
    getOperationalAlerts
};
