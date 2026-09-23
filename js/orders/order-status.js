'use strict';

/*
 * Status oficial do pedido.
 *
 * O status do pedido representa o ciclo operacional/comercial.
 * Pagamento e logística possuem ciclos independentes.
 */

export const ORDER_STATUS = Object.freeze({

    NEW: 'new',

    PENDING: 'pending',

    CONFIRMED: 'confirmed',

    PROCESSING: 'processing',

    SHIPPED: 'shipped',

    DELIVERED: 'delivered',

    CANCELLED: 'cancelled'

});


export const ORDER_STATUS_LABELS = Object.freeze({

    [ORDER_STATUS.NEW]:
        'Novo',

    [ORDER_STATUS.PENDING]:
        'Pendente',

    [ORDER_STATUS.CONFIRMED]:
        'Confirmado',

    [ORDER_STATUS.PROCESSING]:
        'Processando',

    [ORDER_STATUS.SHIPPED]:
        'Enviado',

    [ORDER_STATUS.DELIVERED]:
        'Entregue',

    [ORDER_STATUS.CANCELLED]:
        'Cancelado'

});


export const ORDER_STATUS_FLOW = Object.freeze([

    ORDER_STATUS.NEW,

    ORDER_STATUS.PENDING,

    ORDER_STATUS.CONFIRMED,

    ORDER_STATUS.PROCESSING,

    ORDER_STATUS.SHIPPED,

    ORDER_STATUS.DELIVERED

]);


export function getOrderStatusLabel(status) {

    return (
        ORDER_STATUS_LABELS[status] ??
        'Status desconhecido'
    );

}


export function getNextOrderStatus(status) {

    const index =
        ORDER_STATUS_FLOW.indexOf(status);

    if (index === -1) {
        return null;
    }

    return (
        ORDER_STATUS_FLOW[index + 1] ??
        null
    );

}