'use strict';

const { AppError } = require('../../core/app-error');

const PAYMENT_STATUSES = Object.freeze([
  'pending',
  'paid',
  'failed',
  'cancelled'
]);

function createPaymentIntent({
  orderNumber,
  amount,
  method = 'pix'
}) {
  if (!orderNumber) {
    throw new AppError(
      'Número do pedido não informado.',
      {
        code: 'PAYMENT_ORDER_REQUIRED',
        status: 400
      }
    );
  }

  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(
      'Valor de pagamento inválido.',
      {
        code: 'PAYMENT_AMOUNT_INVALID',
        status: 400
      }
    );
  }

  return {
    orderNumber,
    method,
    amount: Number(value.toFixed(2)),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}

function assertPaymentStatus(status) {
  if (!PAYMENT_STATUSES.includes(status)) {
    throw new AppError(
      `Status de pagamento inválido: ${status}`,
      {
        code: 'PAYMENT_STATUS_INVALID',
        status: 400
      }
    );
  }
}

module.exports = {
  PAYMENT_STATUSES,
  createPaymentIntent,
  assertPaymentStatus
};
