'use strict';

import {
    listOrders,
    getOrder,
    updateOrder
} from './order-repository.js';

function ensureReady() {
    if (!window.AdminFirebaseOrders) {
        throw new Error('Integração Firebase de pedidos não inicializada.');
    }
}

const firebaseOrders = {
    async list() {
        return {
            success: true,
            data: await listOrders(100)
        };
    },

    async details(orderId) {
        if (!orderId) {
            return {
                success: false,
                data: null
            };
        }

        const order = await getOrder(orderId);

        return {
            success: !!order,
            data: order
        };
    },

    async update(orderId, changes) {
        if (!orderId) {
            throw new Error('ID do pedido não informado.');
        }

        const order = await updateOrder(orderId, changes);

        return {
            success: true,
            data: order
        };
    }
};

window.AdminFirebaseOrders = firebaseOrders;

window.dispatchEvent(
    new CustomEvent('aurea:firebase-orders-ready')
);

console.info('[AUREA] Firebase Orders conectado.');