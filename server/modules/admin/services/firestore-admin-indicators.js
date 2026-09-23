"use strict";

/**
 * AURÉA — INDICADORES ADMINISTRATIVOS FIRESTORE
 *
 * Esta camada é a única responsável pelas regras de:
 * - estoque
 * - pagamentos pendentes
 * - envios pendentes
 *
 * IMPORTANTE:
 * - Firestore é a fonte de verdade.
 * - Esta camada NÃO grava dados.
 * - Ela apenas normaliza e calcula indicadores.
 */

const TERMINAL_SHIPMENT_STATUSES = new Set([
    "delivered",
    "completed",
    "cancelled",
    "canceled"
]);

const DEFAULT_MINIMUM_STOCK = 5;

function normalizeStatus(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .trim()
        .toLowerCase();
}

function toNumber(value, fallback = 0) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
}

function getProductStock(product) {
    if (!product || typeof product !== "object") {
        return 0;
    }

    if (
        product.stock !== undefined &&
        product.stock !== null &&
        product.stock !== ""
    ) {
        return toNumber(product.stock);
    }

    if (
        product.estoque !== undefined &&
        product.estoque !== null &&
        product.estoque !== ""
    ) {
        return toNumber(product.estoque);
    }

    return 0;
}

function getProductMinimumStock(product) {
    if (!product || typeof product !== "object") {
        return DEFAULT_MINIMUM_STOCK;
    }

    const configured = toNumber(
        product.minimumStock ??
        product.minStock ??
        product.estoqueMinimo,
        0
    );

    if (configured > 0) {
        return configured;
    }

    return DEFAULT_MINIMUM_STOCK;
}

function isOutOfStock(product) {
    return getProductStock(product) <= 0;
}

function isLowStock(product) {
    const stock = getProductStock(product);

    if (stock <= 0) {
        return false;
    }

    const minimumStock = getProductMinimumStock(product);

    return stock <= minimumStock;
}

function getPaymentStatus(order) {
    if (!order || typeof order !== "object") {
        return "";
    }

    return normalizeStatus(
        order.payment?.status ??
        order.paymentStatus ??
        ""
    );
}

function isPaymentPending(order) {
    return getPaymentStatus(order) === "pending";
}

function getTrackingStatus(tracking) {
    if (!tracking || typeof tracking !== "object") {
        return "";
    }

    return normalizeStatus(
        tracking.status ??
        tracking.logisticsStatus ??
        ""
    );
}

function isShipmentOpen(tracking) {
    const status = getTrackingStatus(tracking);

    /*
     * Documento sem status não é tratado como pendência.
     * Isso evita transformar ausência de dado em obrigação operacional.
     */
    if (!status) {
        return false;
    }

    return !TERMINAL_SHIPMENT_STATUSES.has(status);
}

function calculateStockIndicators(products = []) {
    const safeProducts = Array.isArray(products)
        ? products
        : [];

    let lowStock = 0;
    let outOfStock = 0;

    for (const product of safeProducts) {
        if (isOutOfStock(product)) {
            outOfStock++;
            continue;
        }

        if (isLowStock(product)) {
            lowStock++;
        }
    }

    return {
        lowStock,
        outOfStock
    };
}

function calculatePaymentIndicators(orders = []) {
    const safeOrders = Array.isArray(orders)
        ? orders
        : [];

    return {
        pendingPayments: safeOrders.filter(isPaymentPending).length
    };
}

function calculateShipmentIndicators(tracking = []) {
    const safeTracking = Array.isArray(tracking)
        ? tracking
        : [];

    return {
        pendingShipments: safeTracking.filter(isShipmentOpen).length
    };
}

function calculateIndicators({
    orders = [],
    products = [],
    tracking = []
} = {}) {

    const stock = calculateStockIndicators(products);
    const payments = calculatePaymentIndicators(orders);
    const shipments = calculateShipmentIndicators(tracking);

    return {
        estoqueBaixo: stock.lowStock,
        semEstoque: stock.outOfStock,
        pagamentosPendentes: payments.pendingPayments,
        enviosPendentes: shipments.pendingShipments
    };
}

function buildOperationalAlerts(indicators) {
    const safe = indicators || {};

    const alerts = [];

    if (Number(safe.estoqueBaixo) > 0) {
        alerts.push({
            type: "inventory",
            level: "warning",
            count: Number(safe.estoqueBaixo),
            message: `${Number(safe.estoqueBaixo)} produto(s) com estoque baixo.`
        });
    }

    if (Number(safe.semEstoque) > 0) {
        alerts.push({
            type: "inventory",
            level: "critical",
            count: Number(safe.semEstoque),
            message: `${Number(safe.semEstoque)} produto(s) sem estoque.`
        });
    }

    if (Number(safe.pagamentosPendentes) > 0) {
        alerts.push({
            type: "payment",
            level: "warning",
            count: Number(safe.pagamentosPendentes),
            message: `${Number(safe.pagamentosPendentes)} pagamento(s) pendente(s).`
        });
    }

    if (Number(safe.enviosPendentes) > 0) {
        alerts.push({
            type: "shipping",
            level: "warning",
            count: Number(safe.enviosPendentes),
            message: `${Number(safe.enviosPendentes)} envio(s) em aberto.`
        });
    }

    return alerts;
}

module.exports = {
    DEFAULT_MINIMUM_STOCK,
    TERMINAL_SHIPMENT_STATUSES,

    normalizeStatus,
    toNumber,

    getProductStock,
    getProductMinimumStock,
    isOutOfStock,
    isLowStock,

    getPaymentStatus,
    isPaymentPending,

    getTrackingStatus,
    isShipmentOpen,

    calculateStockIndicators,
    calculatePaymentIndicators,
    calculateShipmentIndicators,
    calculateIndicators,
    buildOperationalAlerts
};