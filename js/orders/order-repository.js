'use strict';

import {
    db
} from '../firebase-config.js';

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ORDERS_COLLECTION = 'orders';
const TRACKING_COLLECTION = 'orderTracking';

function removeUndefined(value) {
    if (Array.isArray(value)) {
        return value
            .map(removeUndefined)
            .filter(item => item !== undefined);
    }

    if (
        value &&
        typeof value === 'object' &&
        !(value instanceof Date)
    ) {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, item]) => item !== undefined)
                .map(([key, item]) => [
                    key,
                    removeUndefined(item)
                ])
        );
    }

    return value;
}

function normalizeOrder(docSnap) {
    if (!docSnap || !docSnap.exists()) {
        return null;
    }

    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        ...data
    };
}

function createTrackingData(order) {
    return {
        id: order.id,
        orderNumber:
            order.orderNumber ||
            null,
        status:
            order.status ||
            'pending',
        paymentStatus:
            order.payment?.status ||
            'pending',
        total:
            Number(
                order.totals?.total ??
                order.total ??
                0
            ),
        logisticsStatus:
            order.logistics?.status ||
            'pending',
        history:
            Array.isArray(order.history)
                ? order.history
                : [],
        updatedAt:
            new Date().toISOString()
    };
}

async function saveTracking(order) {
    if (!order?.id) {
        return null;
    }

    const trackingData =
        createTrackingData(order);

    const trackingRef =
        doc(
            db,
            TRACKING_COLLECTION,
            order.id
        );

    await setDoc(
        trackingRef,
        removeUndefined(trackingData)
    );

    return trackingData;
}

export async function saveOrder(order) {
    if (!order || !order.id) {
        throw new Error(
            'Pedido inválido para gravação.'
        );
    }

    const orderRef =
        doc(
            db,
            ORDERS_COLLECTION,
            order.id
        );

    const sanitizedOrder =
        removeUndefined(order);

    await setDoc(
        orderRef,
        sanitizedOrder,
        {
            merge: true
        }
    );

    try {
        await saveTracking({
            ...sanitizedOrder,
            id: order.id
        });
    } catch (trackingError) {
        console.error(
            '[TRACKING] Erro ao sincronizar rastreamento:',
            trackingError
        );
    }

    const updatedSnapshot =
        await getDoc(orderRef);

    return normalizeOrder(
        updatedSnapshot
    );
}

export async function getOrder(orderId) {
    if (!orderId) {
        return null;
    }

    try {
        const orderRef =
            doc(
                db,
                ORDERS_COLLECTION,
                String(orderId)
            );

        const snapshot =
            await getDoc(orderRef);

        return normalizeOrder(
            snapshot
        );
    } catch (error) {
        console.error(
            '[NEFER ORDERS] Erro ao buscar pedido:',
            error
        );

        return null;
    }
}

export async function findOrderById(orderId) {
    return getOrder(orderId);
}

export async function listOrders(limit = 100) {
    try {
        const snapshot =
            await getDocs(
                collection(
                    db,
                    ORDERS_COLLECTION
                )
            );

        const orders =
            snapshot.docs
                .map(normalizeOrder)
                .filter(order => {
                    return Boolean(
                        order?.orderNumber &&
                        order?.totals &&
                        typeof order.totals === 'object'
                    );
                })
                .sort((a, b) => {
                    const dateA =
                        new Date(
                            a.createdAt || 0
                        ).getTime();

                    const dateB =
                        new Date(
                            b.createdAt || 0
                        ).getTime();

                    return dateB - dateA;
                });

        return orders.slice(
            0,
            Math.max(
                1,
                Number(limit) || 100
            )
        );
    } catch (error) {
        console.error(
            '[NEFER ORDERS] Erro ao listar pedidos:',
            error
        );

        return [];
    }
}

export async function loadOrders() {
    return listOrders(500);
}

export async function updateOrder(order) {
    if (!order || !order.id) {
        throw new Error(
            'Pedido inválido para atualização.'
        );
    }

    const existingOrder =
        await getOrder(order.id);

    if (!existingOrder) {
        throw new Error(
            'Pedido não encontrado para atualização.'
        );
    }

    const updatedOrder = {
        ...existingOrder,
        ...order,
        id: existingOrder.id,
        updatedAt:
            new Date().toISOString()
    };

    return saveOrder(
        updatedOrder
    );
}

export async function findTrackingById(orderId) {
    if (!orderId) {
        return null;
    }

    try {
        const trackingRef =
            doc(
                db,
                TRACKING_COLLECTION,
                String(orderId)
            );

        const snapshot =
            await getDoc(trackingRef);

        if (!snapshot.exists()) {
            return null;
        }

        return {
            id: snapshot.id,
            ...snapshot.data()
        };
    } catch (error) {
        console.error(
            '[TRACKING] Erro ao buscar rastreamento:',
            error
        );

        return null;
    }
}