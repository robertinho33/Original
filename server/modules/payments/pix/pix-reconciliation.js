'use strict';

/*
 * Reservado para conciliação automática.
 *
 * A conciliação real será implementada depois que
 * existir um provedor Pix com API de consulta.
 */

async function reconcilePixPayment() {
    return {
        reconciled: false,
        reason: 'Provedor Pix ainda não conectado.'
    };
}

module.exports = {
    reconcilePixPayment
};
