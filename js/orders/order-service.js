'use strict';

import { saveOrder as repositorySaveOrder } from './order-repository.js';

export function saveOrder(order) {
    if (!order || typeof order !== 'object') {
        throw new Error('Pedido invÃ¡lido.');
    }

    if (!order.id) {
        throw new Error('Pedido sem identificaÃ§Ã£o.');
    }

    if (!order.customer?.name) {
        throw new Error('Pedido sem cliente.');
    }

    if (!Array.isArray(order.items) || !order.items.length) {
        throw new Error('Pedido sem produtos.');
    }

    if (!order.financial) {
        throw new Error('Pedido sem informaÃ§Ãµes financeiras.');
    }

    return repositorySaveOrder(order);
}
