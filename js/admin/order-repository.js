'use strict';

import { db } from '../firebase-config.js';

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    normalizeOrder,
    validateOrder
} from './order-model.js';

const ORDERS_COLLECTION = 'orders';
const TRACKING_COLLECTION = 'orderTracking';

function nowIso() {
    return new Date().toISOString();
}

function buildTracking(order, previousTracking = null) {

    const previousHistory =
        Array.isArray(previousTracking?.history)
            ? previousTracking.history
            : [];

    const orderHistory =
        Array.isArray(order.history)
            ? order.history
            : [];

    return {
        id: order.id,
        orderId: order.orderId || order.id,
        status: order.status || 'new',
        paymentStatus: order.payment?.status || 'pending',
        total: Number(order.total || 0),
        logisticsStatus: order.logistics?.status || 'new',
        history: orderHistory.length
            ? orderHistory
            : previousHistory,
        updatedAt: nowIso()
    };
}

function buildStatusHistoryEvent(order, previousStatus) {

    return {
        type: 'status_changed',
        previousStatus: previousStatus || null,
        status: order.status || null,
        createdAt: nowIso(),
        source: 'admin'
    };
}

export async function createOrder(orderData) {

    const order = normalizeOrder(orderData);
    validateOrder(order);

    const payload = {
        ...order,
        updatedAt: nowIso()
    };

    const orderRef = await addDoc(
        collection(db, ORDERS_COLLECTION),
        payload
    );

    const trackingRef = doc(
        db,
        TRACKING_COLLECTION,
        order.id
    );

    await writeBatch(db)
        .set(trackingRef, buildTracking(order))
        .commit();

    return {
        success: true,
        id: orderRef.id,
        data: order
    };
}

export async function getOrder(orderId) {

    if (!orderId) {
        return null;
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        orderId
    );

    const snapshot = await getDoc(orderRef);

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

export async function listOrders(maxResults = 100) {

    const safeLimit = Math.max(
        1,
        Math.min(Number(maxResults) || 100, 200)
    );

    const ordersQuery = query(
        collection(db, ORDERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(safeLimit)
    );

    const snapshot = await getDocs(ordersQuery);

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function listOrdersByStatus(
    status,
    maxResults = 100
) {

    if (!status) {
        return listOrders(maxResults);
    }

    const safeLimit = Math.max(
        1,
        Math.min(Number(maxResults) || 100, 200)
    );

    const ordersQuery = query(
        collection(db, ORDERS_COLLECTION),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(safeLimit)
    );

    const snapshot = await getDocs(ordersQuery);

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function updateOrder(
    orderId,
    changes = {}
) {

    if (!orderId) {
        throw new Error('ID do pedido não informado.');
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        orderId
    );

    const trackingRef = doc(
        db,
        TRACKING_COLLECTION,
        orderId
    );

    const orderSnapshot = await getDoc(orderRef);

    if (!orderSnapshot.exists()) {
        throw new Error('Pedido não encontrado.');
    }

    const currentOrder = {
        id: orderSnapshot.id,
        ...orderSnapshot.data()
    };

    const previousStatus = currentOrder.status;

    const nextOrder = normalizeOrder({
        ...currentOrder,
        ...changes
    });

    if (
        changes.status &&
        changes.status !== previousStatus
    ) {
        nextOrder.history = [
            ...(Array.isArray(currentOrder.history)
                ? currentOrder.history
                : []),
            buildStatusHistoryEvent(
                nextOrder,
                previousStatus
            )
        ];
    }

    validateOrder(nextOrder);

    const trackingSnapshot = await getDoc(trackingRef);

    const previousTracking = trackingSnapshot.exists()
        ? trackingSnapshot.data()
        : null;

    const tracking = buildTracking(
        nextOrder,
        previousTracking
    );

    const batch = writeBatch(db);

    batch.update(orderRef, {
        ...nextOrder,
        updatedAt: nowIso()
    });

    batch.set(
        trackingRef,
        tracking,
        { merge: true }
    );

    await batch.commit();

    return {
        success: true,
        id: orderId,
        data: nextOrder,
        tracking
    };
}

export async function countOrders() {

    const snapshot = await getDocs(
        collection(db, ORDERS_COLLECTION)
    );

    return snapshot.size;
}
