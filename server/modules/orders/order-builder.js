'use strict';

const { AppError } = require('../../core/app-error');
const { calculateOrderTotal } = require('./order-service');
const { normalizeItems } = require('./order-validator');
const { createOrderDraft } = require('./order-factory');

function buildOrder({
  items,
  shipping = 0,
  discount = 0,
  customer = {},
  paymentMethod = 'pix'
}) {
  const normalized = normalizeItems(items);

  const subtotal = normalized.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice;
  }, 0);

  const total = calculateOrderTotal({
    items: normalized,
    shipping,
    discount
  });

  if (!Number.isFinite(total) || total < 0) {
    throw new AppError(
      'Total do pedido inválido.',
      {
        code: 'INVALID_ORDER_TOTAL',
        status: 400
      }
    );
  }

  return createOrderDraft({
    items: normalized,
    subtotal,
    shipping,
    discount,
    total,
    customer,
    paymentMethod
  });
}

module.exports = {
  buildOrder
};
