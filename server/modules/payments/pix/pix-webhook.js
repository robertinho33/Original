'use strict';

/*
 * Reservado para o webhook do provedor Pix.
 *
 * Quando conectarmos um PSP/banco real:
 *
 * provedor
 *    ↓
 * POST /api/payments/pix/webhook
 *    ↓
 * valida assinatura
 *    ↓
 * consulta pagamento
 *    ↓
 * idempotência
 *    ↓
 * Firestore
 *    ↓
 * payment.status = paid
 */

function processPixWebhook(payload) {
    return {
        received: true,
        processed: false,
        message: 'Webhook aguardando integração com provedor Pix.'
    };
}

module.exports = {
    processPixWebhook
};
