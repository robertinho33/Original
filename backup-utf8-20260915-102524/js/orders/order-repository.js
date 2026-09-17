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

function createTrackingData(order) {
    return {
        id: order.id,
        status: order.status || 'new',
        paymentStatus: order.payment?.status || 'pending',
        total: Number(order.total || 0),
        logisticsStatus: order.logistics?.status || 'new',
        history: Array.isArray(order.history)
            ? order.history
            : [],
        updatedAt: new Date().toISOString()
    };
}

async function saveTracking(order) {
    const trackingData = createTrackingData(order);

    await setDoc(
        doc(db, TRACKING_COLLECTION, order.id),
        trackingData
    );

    return trackingData;
}

export async function saveOrder(order) {
    try {
        await setDoc(
            doc(db, ORDERS_COLLECTION, order.id),
            order
        );

        try {
            await saveTracking(order);
        } catch (trackingError) {
            console.error(
                '[TRACKING] Erro ao sincronizar rastreamento:',
                trackingError
            );
        }

        return {
            success: true,
            id: order.id,
            data: order
        };

    } catch (error) {

        console.error(
            'Erro ao salvar pedido no Firestore:',
            error
        );

        throw new Error(
            'Não foi possível registrar o pedido no banco de dados.'
        );
    }
}

export async function findOrderById(orderId) {

    if (!orderId) {
        return null;
    }

    try {

        const docRef =
            doc(
                db,
                ORDERS_COLLECTION,
                orderId
            );

        const docSnap =
            await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }

        return null;

    } catch (error) {

        console.error(
            'Erro ao buscar pedido por ID:',
            error
        );

        return null;
    }
}

export async function findTrackingById(orderId) {

    if (!orderId) {
        return null;
    }

    try {

        const docRef =
            doc(
                db,
                TRACKING_COLLECTION,
                orderId
            );

        const docSnap =
            await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }

        return null;

    } catch (error) {

        console.error(
            '[TRACKING] Erro ao buscar rastreamento:',
            error
        );

        return null;
    }
}

export async function loadOrders() {

    try {

        const querySnapshot =
            await getDocs(
                collection(
                    db,
                    ORDERS_COLLECTION
                )
            );

        const orders = [];

        querySnapshot.forEach(
            docSnap => {
                orders.push(
                    docSnap.data()
                );
            }
        );

        return orders;

    } catch (error) {

        console.error(
            'Erro ao carregar lista de pedidos:',
            error
        );

        return [];
    }
}

export async function updateOrder(order) {

    if (!order || !order.id) {
        throw new Error(
            'Pedido inválido para atualização.'
        );
    }

    const existingOrder =
        await findOrderById(order.id);

    if (!existingOrder) {
        throw new Error(
            'Pedido não encontrado para atualização.'
        );
    }

    return await saveOrder(order);
}
