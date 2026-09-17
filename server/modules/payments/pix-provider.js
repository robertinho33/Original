'use strict';

/*
 * Adapter do PIX.
 *
 * IMPORTANTE:
 * A implementação atual do endpoint PIX permanece no server.js.
 * Este adapter não gera outro QR Code e não substitui o provider atual.
 */

function createPixReference({
  orderNumber,
  amount
}) {
  return {
    provider: 'pix',
    orderNumber,
    amount: Number(Number(amount).toFixed(2)),
    status: 'pending'
  };
}

module.exports = {
  createPixReference
};
