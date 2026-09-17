'use strict';

const crypto = require('crypto');

function createOrderNumber() {
  const random = crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase();

  return `AUR-${random}`;
}

function createOrderDraft({
  items,
  subtotal,
  shipping = 0,
  discount = 0,
  total,
  customer = {},
  paymentMethod = 'pix'
}) {
  const now = new Date().toISOString();

  return {
    orderNumber: createOrderNumber(),

    status: 'pending',

    items,

    totals: {
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(Number(shipping).toFixed(2)),
      discount: Number(Number(discount).toFixed(2)),
      total: Number(total.toFixed(2))
    },

    customer,

    payment: {
      method: paymentMethod,
      status: 'pending'
    },

    logistics: {
      status: 'pending'
    },

    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  createOrderDraft,
  createOrderNumber
};
