'use strict';

/*
 * Fluxo exclusivamente logístico.
 *
 * Pagamento possui seu próprio status.
 */

export const LOGISTICS_STATUS = Object.freeze({

    NEW: 'new',

    PREPARING: 'preparing',

    PACKED: 'packed',

    SHIPPED: 'shipped',

    IN_TRANSIT: 'in_transit',

    OUT_FOR_DELIVERY: 'out_for_delivery',

    DELIVERED: 'delivered'

});


export const LOGISTICS_STATUS_LABELS = Object.freeze({

    [LOGISTICS_STATUS.NEW]:
        'Pedido recebido',

    [LOGISTICS_STATUS.PREPARING]:
        'Em preparação',

    [LOGISTICS_STATUS.PACKED]:
        'Pedido embalado',

    [LOGISTICS_STATUS.SHIPPED]:
        'Despachado',

    [LOGISTICS_STATUS.IN_TRANSIT]:
        'Em trânsito',

    [LOGISTICS_STATUS.OUT_FOR_DELIVERY]:
        'Saiu para entrega',

    [LOGISTICS_STATUS.DELIVERED]:
        'Entregue'

});


export function getLogisticsStatusLabel(status) {

    return (
        LOGISTICS_STATUS_LABELS[status] ??
        'Status desconhecido'
    );

}


export const LOGISTICS_FLOW = Object.freeze([

    LOGISTICS_STATUS.NEW,

    LOGISTICS_STATUS.PREPARING,

    LOGISTICS_STATUS.PACKED,

    LOGISTICS_STATUS.SHIPPED,

    LOGISTICS_STATUS.IN_TRANSIT,

    LOGISTICS_STATUS.OUT_FOR_DELIVERY,

    LOGISTICS_STATUS.DELIVERED

]);


export function getNextLogisticsStatus(status) {

    const index =
        LOGISTICS_FLOW.indexOf(status);

    if (index === -1) {
        return null;
    }

    return (
        LOGISTICS_FLOW[index + 1] ??
        null
    );

}
