'use strict';

/*
 * Eventos que podem aparecer na linha do tempo
 * do pedido.
 */

export const ORDER_EVENT = Object.freeze({

    ORDER_CREATED:
        'ORDER_CREATED',

    PIX_GENERATED:
        'PIX_GENERATED',

    PAYMENT_CONFIRMED:
        'PAYMENT_CONFIRMED',

    PREPARING:
        'PREPARING',

    PACKED:
        'PACKED',

    SHIPPED:
        'SHIPPED',

    IN_TRANSIT:
        'IN_TRANSIT',

    OUT_FOR_DELIVERY:
        'OUT_FOR_DELIVERY',

    DELIVERED:
        'DELIVERED'

});


export const ORDER_EVENT_LABELS = Object.freeze({

    [ORDER_EVENT.ORDER_CREATED]:
        'Pedido criado',

    [ORDER_EVENT.PIX_GENERATED]:
        'Pagamento PIX gerado',

    [ORDER_EVENT.PAYMENT_CONFIRMED]:
        'Pagamento confirmado',

    [ORDER_EVENT.PREPARING]:
        'Pedido em preparação',

    [ORDER_EVENT.PACKED]:
        'Pedido embalado',

    [ORDER_EVENT.SHIPPED]:
        'Pedido despachado',

    [ORDER_EVENT.IN_TRANSIT]:
        'Pedido em trânsito',

    [ORDER_EVENT.OUT_FOR_DELIVERY]:
        'Saiu para entrega',

    [ORDER_EVENT.DELIVERED]:
        'Pedido entregue'

});


export function createOrderEvent(
    type,
    details = null
) {

    if (!type) {
        throw new Error(
            'Evento do pedido não informado.'
        );
    }

    return {

        id:
            `EVT-${Date.now().toString(36).toUpperCase()}`,

        type,

        label:
            ORDER_EVENT_LABELS[type] ??
            'Evento do pedido',

        createdAt:
            new Date().toISOString(),

        details

    };

}


export function appendOrderEvent(
    order,
    type,
    details = null
) {

    if (!order || typeof order !== 'object') {
        throw new Error(
            'Pedido inválido.'
        );
    }

    const event =
        createOrderEvent(type, details);

    const history =
        Array.isArray(order.history)
            ? order.history
            : [];

    order.history = [
        ...history,
        event
    ];

    return order;

}
