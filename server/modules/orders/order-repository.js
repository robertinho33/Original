'use strict';

const {
    getFirestore
} = require('../../infrastructure/firebase/firebase-admin');

function getDb() {
    return getFirestore();
}

function ordersCollection() {
    return getDb().collection('orders');
}

function normalizeOrder(doc) {
    if (!doc || !doc.exists) {
        return null;
    }

    return {
        id: doc.id,
        ...doc.data()
    };
}

async function create(order, attempt = null) {
    const now = new Date().toISOString();

    const storedOrder = {
        ...order,
        createdAt: order.createdAt || now,
        updatedAt: now
    };

    const docRef = attempt ? ordersCollection().doc(attempt.documentId) : ordersCollection().doc();
    if (attempt) storedOrder.pixAttemptFingerprint = attempt.fingerprint;
    const db = getDb();
    const inventory = require('../inventory/stock-reservations');
    const grouped = inventory.aggregateItems(storedOrder.items);
    const reservationOrder = { ...storedOrder, items: grouped.map(item => ({
        ...item, unitPrice: storedOrder.items.find(original => original.sku === item.sku).unitPrice
    })) };
    const plans = await inventory.prepareReservation(db, reservationOrder, 'production_inventory');
    let reused = null;
    await db.runTransaction(async tx => {
    if (attempt) {
        const existing = await tx.get(docRef);
        if (existing.exists) {
            reused = { id: docRef.id, ...existing.data() };
            require('./pix-attempt').checkAttempt(reused, attempt);
            return;
        }
    }
    storedOrder.stock = await inventory.reserveInTransaction(tx, plans);
    tx.create(docRef, storedOrder);

    if (storedOrder.publicTrackingToken) {
        const logistics = storedOrder.logistics || {};
        const payment = storedOrder.payment || {};
        tx.set(db.collection('orderTracking').doc(storedOrder.publicTrackingToken), {
                id: storedOrder.orderNumber || docRef.id,
                orderNumber: storedOrder.orderNumber || docRef.id,
                createdAt: storedOrder.createdAt,
                status: storedOrder.status || 'pending',
                paymentStatus: payment.status || 'pending',
                paymentConfirmedAt: payment.confirmedAt || payment.paidAt || null,
                total: Number(storedOrder.totals?.total || 0),
                logisticsStatus: logistics.status || 'new',
                carrier: logistics.carrier || '',
                trackingCode: logistics.trackingCode || '',
                postedAt: logistics.postedAt || null,
                estimatedDelivery: logistics.estimatedDelivery || null,
                deliveredAt: logistics.deliveredAt || null,
                history: [],
                updatedAt: now
            });
    }

    });
    if (reused) return reused;
    require('../catalog/catalog-storefront-service').invalidate();
    return {
        id: docRef.id,
        ...storedOrder
    };
}

async function findByOrderNumber(orderNumber) {
    const snapshot = await ordersCollection()
        .where('orderNumber', '==', String(orderNumber))
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    return normalizeOrder(snapshot.docs[0]);
}

async function findByEmail(email) {
    const normalized = String(email || '')
        .trim()
        .toLowerCase();

    if (!normalized) {
        return [];
    }

    const snapshot = await ordersCollection()
        .where('customer.email', '==', normalized)
        .get();

    return snapshot.docs.map(normalizeOrder);
}

async function findAll({
    limit = 100,
    offset = 0
} = {}) {
    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit) || 100,
            500
        )
    );

    const safeOffset = Math.max(
        0,
        Number(offset) || 0
    );

    const snapshot = await ordersCollection()
        .orderBy('createdAt', 'desc')
        .offset(safeOffset)
        .limit(safeLimit)
        .get();

    return snapshot.docs.map(normalizeOrder);
}

async function update(orderNumber, changes) {
    const snapshot = await ordersCollection()
        .where('orderNumber', '==', String(orderNumber))
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];

    const updatedOrder = {
        ...changes,
        updatedAt: new Date().toISOString()
    };

    await doc.ref.set(
        updatedOrder,
        {
            merge: true
        }
    );

    const updatedSnapshot = await doc.ref.get();

    return normalizeOrder(updatedSnapshot);
}

module.exports = {
    create,
    findByOrderNumber,
    findByEmail,
    findAll,
    update
};
