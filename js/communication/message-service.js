'use strict';

import {
    createPurchaseThankYouMessage,
    createPurchaseThankYouEmail
} from './message-templates.js';


export function createPurchaseThankYou(order) {

    if (!order) {
        throw new Error('Pedido não informado.');
    }

    return {
        whatsapp: createPurchaseThankYouMessage({
            customerName: order.customer?.name,
            orderId: order.id,
            total: order.total
        }),

        email: createPurchaseThankYouEmail({
            customerName: order.customer?.name,
            orderId: order.id,
            total: order.total
        })
    };
}
