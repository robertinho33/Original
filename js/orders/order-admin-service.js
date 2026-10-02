'use strict';

import {
    getOrder,
    updateOrder as updateFirebaseOrder
} from '../admin/order-repository.js';

import {
    ORDER_STATUS
} from './order-status.js';

import {
    LOGISTICS_FLOW,
    LOGISTICS_STATUS
} from './logistics-status.js';

import {
    ORDER_EVENT,
    appendOrderEvent
} from './order-history.js';


function cloneOrder(order) {
    return structuredClone(order);
}


function createUpdatedTimestamp() {
    return new Date().toISOString();
}


export async function confirmPayment(orderId) {
    if (!orderId) {
        throw new Error(
            'Identificação do pedido não informada.'
        );
    }

    const order =
        await getOrder(orderId);

    if (!order) {
        throw new Error(
            'Pedido não encontrado no Firestore.'
        );
    }

    if (!order.payment) {
        order.payment = {};
    }

    order.payment.status = 'confirmed';
    order.payment.confirmedAt =
        createUpdatedTimestamp();

    order.status =
        ORDER_STATUS.PROCESSING;

    appendOrderEvent(
        order,
        ORDER_EVENT.PAYMENT_CONFIRMED,
        {
            paymentMethod:
                order.payment.method || 'pix'
        }
    );

    const updatedOrder =
        await updateFirebaseOrder(
            order.id,
            {
                payment: order.payment,
                status: order.status,
                history: order.history,
                updatedAt: createUpdatedTimestamp()
            }
        );

    return updatedOrder;
}
export async function advanceLogistics(orderId) {
    if (!orderId) {
        throw new Error(
            'Identificação do pedido não informada.'
        );
    }

    const order =
        await getOrder(orderId);

    if (!order) {
        throw new Error(
            'Pedido não encontrado no Firestore.'
        );
    }

    const currentStatus =
        order.logistics?.status ||
        'pending';

    const statusFlow = {
        pending: 'processing',
        processing: 'shipped',
        shipped: 'delivered',
        delivered: 'delivered'
    };

    const nextStatus =
        statusFlow[currentStatus];

    if (!nextStatus) {
        throw new Error(
            'Status logístico inválido.'
        );
    }

    if (currentStatus === 'delivered') {
        return order;
    }

    const updatedLogistics = {
        ...(order.logistics || {}),
        status: nextStatus,
        updatedAt: createUpdatedTimestamp()
    };

    const history =
        Array.isArray(order.history)
            ? [...order.history]
            : [];

    history.push({
        type: 'logistics_status_changed',
        previousStatus: currentStatus,
        status: nextStatus,
        createdAt: createUpdatedTimestamp(),
        source: 'admin'
    });

    return await updateFirebaseOrder(
        order.id,
        {
            logistics: updatedLogistics,
            history,
            updatedAt: createUpdatedTimestamp()
        }
    );
}
