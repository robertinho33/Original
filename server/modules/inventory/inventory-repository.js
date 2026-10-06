"use strict";

const { getFirestore } = require("../../infrastructure/firebase/firebase-admin");

const db = getFirestore();

const INVENTORY_COLLECTION = "inventory";
const PRODUCTS_COLLECTION = "products";
const RESERVATIONS_COLLECTION = "inventoryReservations";

function mapInventory(id, data = {}) {
    const quantity = Number(data.quantity ?? data.stock ?? 0);
    const reserved = Number(data.reserved ?? 0);

    return {
        id,
        sku: String(data.sku ?? id),
        productId: data.productId ?? null,
        quantity,
        reserved,
        available: Number(
            data.available ?? Math.max(0, quantity - reserved)
        ),
        minimumStock: Number(data.minimumStock ?? data.minStock ?? 0),
        updatedAt: data.updatedAt ?? null,
        createdAt: data.createdAt ?? null
    };
}

function mapReservation(id, data = {}) {
    return {
        id,
        sku: String(data.sku ?? ""),
        quantity: Number(data.quantity ?? 0),
        status: data.status ?? "active",
        orderId: data.orderId ?? null,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null
    };
}

async function getItem(sku) {
    const normalizedSku = String(sku ?? "").trim();

    if (!normalizedSku) return null;

    const ref = db.collection(INVENTORY_COLLECTION).doc(normalizedSku);
    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    return mapInventory(snapshot.id, snapshot.data());
}

async function getAllItems() {
    const snapshot = await db.collection(INVENTORY_COLLECTION).get();

    return snapshot.docs.map((doc) =>
        mapInventory(doc.id, doc.data())
    );
}

async function upsertItem(sku, data = {}) {
    const normalizedSku = String(sku ?? "").trim();

    if (!normalizedSku) {
        throw new Error("SKU do estoque é obrigatório.");
    }

    const ref = db.collection(INVENTORY_COLLECTION).doc(normalizedSku);
    const existing = await ref.get();
    const current = existing.exists ? existing.data() : {};

    const quantity = Number(
        data.quantity ??
        data.stock ??
        current.quantity ??
        current.stock ??
        0
    );

    const reserved = Number(
        data.reserved ??
        current.reserved ??
        0
    );

    const productId =
        data.productId ??
        current.productId ??
        null;

    const now = new Date().toISOString();

    const payload = {
        sku: normalizedSku,
        productId,
        quantity,
        reserved,
        available: Math.max(0, quantity - reserved),
        minimumStock: Number(
            data.minimumStock ??
            data.minStock ??
            current.minimumStock ??
            current.minStock ??
            0
        ),
        updatedAt: now,
        ...(existing.exists
            ? {}
            : { createdAt: now })
    };

    const batch = db.batch();

    batch.set(ref, payload, { merge: true });

    if (productId) {
        const productRef = db
            .collection(PRODUCTS_COLLECTION)
            .doc(String(productId));

        batch.update(productRef, {
            stock: quantity,
            updatedAt: now
        });
    }

    await batch.commit();

    return mapInventory(normalizedSku, payload);
}

async function updateItem(sku, changes = {}) {
    const normalizedSku = String(sku ?? "").trim();

    if (!normalizedSku) {
        throw new Error("SKU do estoque é obrigatório.");
    }

    const current = await getItem(normalizedSku);

    if (!current) {
        return upsertItem(normalizedSku, changes);
    }

    return upsertItem(normalizedSku, {
        ...current,
        ...changes
    });
}

async function createReservation(data = {}) {
    const ref = db.collection(RESERVATIONS_COLLECTION).doc();

    const now = new Date().toISOString();

    const payload = {
        sku: String(data.sku ?? ""),
        quantity: Number(data.quantity ?? 0),
        status: data.status ?? "active",
        orderId: data.orderId ?? null,
        createdAt: now,
        updatedAt: now
    };

    await ref.set(payload);

    return mapReservation(ref.id, payload);
}

async function getReservation(id) {
    if (!id) return null;

    const ref = db
        .collection(RESERVATIONS_COLLECTION)
        .doc(String(id));

    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    return mapReservation(snapshot.id, snapshot.data());
}

async function updateReservation(id, changes = {}) {
    if (!id) {
        throw new Error("ID da reserva é obrigatório.");
    }

    const ref = db
        .collection(RESERVATIONS_COLLECTION)
        .doc(String(id));

    const snapshot = await ref.get();

    if (!snapshot.exists) {
        return null;
    }

    const payload = {
        ...changes,
        updatedAt: new Date().toISOString()
    };

    await ref.set(payload, { merge: true });

    const updated = await ref.get();

    return mapReservation(updated.id, updated.data());
}

async function getAllReservations() {
    const snapshot = await db
        .collection(RESERVATIONS_COLLECTION)
        .get();

    return snapshot.docs.map((doc) =>
        mapReservation(doc.id, doc.data())
    );
}

async function deleteReservation(id) {
    if (!id) return false;

    await db
        .collection(RESERVATIONS_COLLECTION)
        .doc(String(id))
        .delete();

    return true;
}

module.exports = {
    getItem,
    getAllItems,
    upsertItem,
    updateItem,
    createReservation,
    getReservation,
    updateReservation,
    getAllReservations,
    deleteReservation
};
