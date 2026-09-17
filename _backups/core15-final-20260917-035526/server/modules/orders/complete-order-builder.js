'use strict';

const { AppError } = require('../../core/app-error');

const {
  prepareCustomerAndShipping
} = require('../shipping/customer-shipping');

const {
  prepareOrder
} = require('./order-authority');

function buildCompleteOrder(payload = {}) {
  const {
    items,
    customer = {},
    address = null,
    deliveryMethod = 'delivery',
    discount = 0,
    paymentMethod = 'pix'
  } = payload;

  const customerShipping =
    prepareCustomerAndShipping({
      customer,
      address,
      deliveryMethod
    });

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      'O pedido precisa conter produtos.',
      {
        code: 'ORDER_ITEMS_REQUIRED',
        status: 400
      }
    );
  }

  const order = prepareOrder({
    items,
    shipping: customerShipping.shipping.cost,
    discount,
    customer: customerShipping.customer,
    paymentMethod
  });

  return {
    ...order,

    shipping: customerShipping.shipping,

    customer: customerShipping.customer,

    totals: {
      ...order.totals,
      shipping: Number(
        customerShipping.shipping.cost.toFixed(2)
      )
    }
  };
}

module.exports = {
  buildCompleteOrder
};
