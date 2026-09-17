'use strict';

import { 
    saveOrder as repositorySaveOrder,
    findOrderById as repositoryFindOrderById,
    loadOrders as repositoryLoadOrders,
    updateOrder as repositoryUpdateOrder
} from './order-repository.js';

export async function saveOrder(order) {
    if (!order || typeof order !== 'object') {
        throw new Error('Pedido inválido.');
    }

    if (!order.id) {
        throw new Error('Pedido sem identificação.');
    }

    if (!order.customer?.name) {
        throw new Error('Pedido sem cliente.');
    }

    if (!Array.isArray(order.items) || !order.items.length) {
        throw new Error('Pedido sem produtos.');
    }

    const subtotal = Number(order.financial?.subtotal ?? order.subtotal);
    const shipping = Number(order.financial?.shipping ?? order.shipping);
    const total = Number(order.financial?.total ?? order.total);

    if (!Number.isFinite(subtotal) || !Number.isFinite(shipping) || !Number.isFinite(total)) {
        throw new Error('Pedido sem informações financeiras válidas.');
    }

    order.status = order.status || 'new';
    
    if (!order.payment) order.payment = {};
    order.payment.status = order.payment.status || 'pending';

    if (!order.logistics) order.logistics = {};
    order.logistics.status = order.logistics.status || 'new';

    if (!Array.isArray(order.history)) {
        order.history = [
            {
                status: order.status,
                updatedAt: new Date().toISOString(),
                note: 'Pedido criado no checkout'
            }
        ];
    }

    return await repositorySaveOrder(order);
}

export async function getOrderById(orderId) {
    return await repositoryFindOrderById(orderId);
}

export async function getAllOrders() {
    return await repositoryLoadOrders();
}

export async function updateOrder(order) {
    return await repositoryUpdateOrder(order);
}
