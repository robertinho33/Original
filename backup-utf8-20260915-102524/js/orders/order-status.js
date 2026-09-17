'use strict';

/*
 * Status geral do pedido.
 *
 * O status do pedido não substitui o status
 * de pagamento nem o status de logística.
 */

export const ORDER_STATUS = Object.freeze({

    NEW: 'new',

    PROCESSING: 'processing',

    COMPLETED: 'completed',

    CANCELLED: 'cancelled'

});


export const ORDER_STATUS_LABELS = Object.freeze({

    [ORDER_STATUS.NEW]:
        'Pedido criado',

    [ORDER_STATUS.PROCESSING]:
        'Em processamento',

    [ORDER_STATUS.COMPLETED]:
        'Concluído',

    [ORDER_STATUS.CANCELLED]:
        'Cancelado'

});


export function getOrderStatusLabel(status) {

    return (
        ORDER_STATUS_LABELS[status] ??
        'Status desconhecido'
    );

}
