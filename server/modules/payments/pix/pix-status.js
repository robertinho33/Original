'use strict';

/*
 * Nesta primeira etapa o núcleo somente representa
 * o estado do pagamento.
 *
 * NÃO marcamos pagamento como "paid" apenas porque
 * o QR Code foi criado.
 */

const PAYMENT_STATUS = Object.freeze({
    PENDING: 'pending',
    PAID: 'paid',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
});

function normalizePaymentStatus(status) {
    const value = String(status || '').toLowerCase();

    if (Object.values(PAYMENT_STATUS).includes(value)) {
        return value;
    }

    return PAYMENT_STATUS.PENDING;
}

module.exports = {
    PAYMENT_STATUS,
    normalizePaymentStatus
};
