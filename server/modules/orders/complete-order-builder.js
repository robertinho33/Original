'use strict';

const {
  prepareCustomerAndShipping
} = require('../shipping/customer-shipping');

const {
  prepareOrder
} = require('./order-authority');

async function buildCompleteOrder(payload = {}) {
  const {
    items,
    customer = {},
    address = null,
    deliveryMethod = 'delivery',
    discount = 0,
    paymentMethod = 'pix',
    coupon = null
  } = payload;

  const customerShipping =
    prepareCustomerAndShipping({
      customer,
      address,
      deliveryMethod
    });

  if (!items || !Array.isArray(items)) {
    throw new Error(
      'Itens do pedido são obrigatórios.'
    );
  }

  const order = await prepareOrder({
    items,
    shipping: customerShipping.shipping.cost,
    discount,
    customer: customerShipping.customer,
    paymentMethod,
    coupon
  });

  return {
    ...order,
    address,
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
