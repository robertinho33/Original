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
    discount: ignoredClientDiscount = 0,
    paymentMethod = 'pix',
    coupon: requestedCoupon = null
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
    discount: 0,
    customer: customerShipping.customer,
    paymentMethod,
    coupon: null
  });

  let coupon = null;
  let discount = 0;
  if (requestedCoupon?.code) {
    const { validateCoupon } = require('../coupons/coupon-service');
    const result = await validateCoupon(requestedCoupon.code);
    if (!result.valid) {
      const { AppError } = require('../../core/app-error');
      throw new AppError(result.message || 'Cupom inválido.', { status: 400, code: 'INVALID_COUPON' });
    }
    coupon = result.coupon;
    const subtotal = order.totals.subtotal;
    const value = Number(coupon.discount);
    discount = Number(Math.min(subtotal, Math.max(0, coupon.discountType === 'percentage' ? subtotal * value / 100 : value)).toFixed(2));
  }
  order.coupon = coupon;
  order.totals.discount = discount;
  order.totals.total = Number((order.totals.subtotal + customerShipping.shipping.cost - discount).toFixed(2));

  return {
    ...order,
    address,
    deliveryMethod: customerShipping.shipping.method,
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
