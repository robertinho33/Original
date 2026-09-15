'use strict';

import {
    getOrderById,
    updateOrder
} from './order-service.js';

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

    const existingOrder =
        await getOrderById(orderId);

    if (!existingOrder) {
        throw new Error(
            'Pedido não encontrado.'
        );
    }

    const order =
        cloneOrder(existingOrder);

    const currentPaymentStatus =
        order.payment?.status || 'pending';

    if (currentPaymentStatus === 'confirmed') {
        throw new Error(
            'O pagamento deste pedido já está confirmado.'
        );
    }

    if (
        currentPaymentStatus === 'cancelled' ||
        currentPaymentStatus === 'rejected'
    ) {
        throw new Error(
            'Não é possível confirmar um pagamento cancelado.'
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
                order.payment.method || null
        }
    );

    await updateOrder(order);

    return order;
}


export async function advanceLogistics(orderId) {

    if (!orderId) {
        throw new Error(
            'Identificação do pedido não informada.'
        );
    }

    const existingOrder =
        await getOrderById(orderId);

    if (!existingOrder) {
        throw new Error(
            'Pedido não encontrado.'
        );
    }

    const order =
        cloneOrder(existingOrder);

    const paymentStatus =
        order.payment?.status || 'pending';

    if (paymentStatus !== 'confirmed') {
        throw new Error(
            'O pagamento precisa estar confirmado antes do avanço logístico.'
        );
    }

    if (!order.logistics) {
        order.logistics = {};
    }

    const currentStatus =
        order.logistics.status ||
        LOGISTICS_STATUS.NEW;

    const currentIndex =
        LOGISTICS_FLOW.indexOf(currentStatus);

    if (currentIndex === -1) {
        throw new Error(
            'Status logístico inválido.'
        );
    }

    const nextStatus =
        LOGISTICS_FLOW[currentIndex + 1];

    if (!nextStatus) {
        throw new Error(
            'O pedido já está com a entrega concluída.'
        );
    }

    order.logistics.status =
        nextStatus;

    if (nextStatus === LOGISTICS_STATUS.DELIVERED) {
        order.status =
            ORDER_STATUS.COMPLETED;
    } else {
        order.status =
            ORDER_STATUS.PROCESSING;
    }

    const eventMap = {
        [LOGISTICS_STATUS.PREPARING]:
            ORDER_EVENT.PREPARING,

        [LOGISTICS_STATUS.PACKED]:
            ORDER_EVENT.PACKED,

        [LOGISTICS_STATUS.SHIPPED]:
            ORDER_EVENT.SHIPPED,

        [LOGISTICS_STATUS.IN_TRANSIT]:
            ORDER_EVENT.IN_TRANSIT,

        [LOGISTICS_STATUS.OUT_FOR_DELIVERY]:
            ORDER_EVENT.OUT_FOR_DELIVERY,

        [LOGISTICS_STATUS.DELIVERED]:
            ORDER_EVENT.DELIVERED
    };

    const eventType =
        eventMap[nextStatus];

    if (eventType) {
        appendOrderEvent(
            order,
            eventType
        );
    }

    await updateOrder(order);

    return order;
}
