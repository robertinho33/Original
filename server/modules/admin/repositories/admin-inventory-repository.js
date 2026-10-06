"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const db = getFirestore();

const PRODUCTS_COLLECTION = "products";
const INVENTORY_COLLECTION = "inventory";
const MOVEMENTS_COLLECTION = "inventoryMovements";
const RESERVATIONS_COLLECTION = "inventoryReservations";
const AUDIT_COLLECTION = "auditLogs";

function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function normalizeProductId(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}

async function findProduct(productId) {
    const normalizedId = normalizeProductId(productId);

    if (!normalizedId) {
        return null;
    }

    const directRef = db.collection(PRODUCTS_COLLECTION).doc(normalizedId);
    const directSnapshot = await directRef.get();

    if (directSnapshot.exists) {
        return {
            ref: directRef,
            id: directSnapshot.id,
            data: directSnapshot.data() || {}
        };
    }

    const skuSnapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where("sku", "==", normalizedId)
        .limit(1)
        .get();

    if (!skuSnapshot.empty) {
        const doc = skuSnapshot.docs[0];

        return {
            ref: doc.ref,
            id: doc.id,
            data: doc.data() || {}
        };
    }

    return null;
}

function inventoryId(product) {
    const sku = String(product.data.sku || "").trim();

    return sku || product.id;
}

async function getStockDetails(productId) {
    const product = await findProduct(productId);

    if (!product) {
        return null;
    }

    const inventoryRef = db
        .collection(INVENTORY_COLLECTION)
        .doc(inventoryId(product));

    const inventorySnapshot = await inventoryRef.get();
    const inventory = inventorySnapshot.exists
        ? inventorySnapshot.data() || {}
        : {};

    const stock = toNumber(
        inventory.quantity,
        toNumber(product.data.stock)
    );

    const reservedStock = toNumber(
        inventory.reserved,
        0
    );

    return {
        id: product.id,
        sku: product.data.sku || product.id,
        name: product.data.name || "",
        stock,
        reserved_stock: reservedStock,
        available_stock: Math.max(0, stock - reservedStock)
    };
}

async function createMovement(data) {
    const productId = normalizeProductId(
        data?.product_id ?? data?.productId
    );

    const quantity = toNumber(data?.quantity, 0);

    if (!productId || !quantity || quantity === 0) {
        throw new Error("Produto e quantidade são obrigatórios.");
    }

    const product = await findProduct(productId);

    if (!product) {
        throw new Error("Produto não encontrado.");
    }

    const inventoryRef = db
        .collection(INVENTORY_COLLECTION)
        .doc(inventoryId(product));

    const movementRef = db
        .collection(MOVEMENTS_COLLECTION)
        .doc();

    const auditRef = db
        .collection(AUDIT_COLLECTION)
        .doc();

    const result = await db.runTransaction(async (transaction) => {
        const inventorySnapshot = await transaction.get(inventoryRef);
        const productSnapshot = await transaction.get(product.ref);

        const productData = productSnapshot.data() || {};
        const inventoryData = inventorySnapshot.exists
            ? inventorySnapshot.data() || {}
            : {};

        const previousStock = toNumber(
            inventoryData.quantity,
            toNumber(productData.stock)
        );

        const reservedStock = toNumber(
            inventoryData.reserved,
            0
        );

        const nextStock = previousStock + quantity;

        if (nextStock < 0) {
            throw new Error("Estoque insuficiente.");
        }

        const now = new Date().toISOString();

        const inventoryPayload = {
            sku: productData.sku || product.id,
            productId: product.id,
            quantity: nextStock,
            reserved: reservedStock,
            available: Math.max(0, nextStock - reservedStock),
            updatedAt: now,
            ...(inventorySnapshot.exists
                ? {}
                : { createdAt: now })
        };

        transaction.set(
            inventoryRef,
            inventoryPayload,
            { merge: true }
        );

        transaction.set(
            product.ref,
            {
                stock: nextStock,
                updatedAt: now
            },
            { merge: true }
        );

        const movement = {
            id: movementRef.id,
            productId: product.id,
            product_id: product.id,
            sku: productData.sku || product.id,
            quantity,
            type: data.type || (quantity > 0 ? "in" : "out"),
            reason: data.reason || "admin",
            previousStock,
            currentStock: nextStock,
            createdAt: now
        };

        transaction.set(movementRef, movement);

        transaction.set(auditRef, {
            id: auditRef.id,
            action: "inventory_movement",
            entityType: "product",
            entity_type: "product",
            entityId: product.id,
            entity_id: product.id,
            details: {
                quantity,
                previousStock,
                nextStock,
                reason: data.reason || "admin"
            },
            createdAt: now
        });

        return {
            product_id: product.id,
            previous_stock: previousStock,
            movement: quantity,
            current_stock: nextStock,
            record: movement
        };
    });

    return result;
}

async function getReservations() {
    const snapshot = await db
        .collection(RESERVATIONS_COLLECTION)
        .orderBy("createdAt", "desc")
        .get();

    const reservations = [];

    for (const doc of snapshot.docs) {
        const reservation = doc.data() || {};

        const productId =
            reservation.productId ??
            reservation.product_id ??
            "";

        let product = null;

        if (productId) {
            product = await findProduct(productId);
        }

        const sku =
            reservation.sku ||
            product?.data?.sku ||
            "";

        const name =
            reservation.name ||
            product?.data?.name ||
            "";

        reservations.push({
            id: doc.id,
            ...reservation,
            product_id: product?.id || productId || null,
            sku,
            name
        });
    }

    return reservations;
}

module.exports = {
    getStockDetails,
    createMovement,
    getReservations
};