'use strict';

const {
  buildCompleteOrder
} = require('./complete-order-builder');

const {
  createOrder,
  getOrder,
  updateOrder
} = require('./order-persistence');

const {
  reserveOrderStock
} = require('./order-orchestrator');

const {
  createPaymentIntent
} = require('../payments/payment-service');

const {
  createPixReference
} = require('../payments/pix-provider');

const {
  recordEvent
} = require('../../infrastructure/audit');

function createCompleteOrder(payload, requestId) {
  const draft = buildCompleteOrder(payload);

  const order = createOrder({
    ...draft,
    status: 'pending'
  });

  recordEvent({
    type: 'ORDER_CREATED',
    orderNumber: order.orderNumber,
    requestId,
    data: {
      total: order.totals.total,
      deliveryMethod: order.shipping.method
    }
  });

  const reservations =
    reserveOrderStock(order);

  recordEvent({
    type: 'STOCK_RESERVED',
    orderNumber: order.orderNumber,
    requestId,
    data: {
      reservations
    }
  });

  const payment =
    createPaymentIntent({
      orderNumber: order.orderNumber,
      amount: order.totals.total,
      method: order.payment.method
    });

  const pixReference =
    payment.method === 'pix'
      ? createPixReference({
          orderNumber: order.orderNumber,
          amount: order.totals.total
        })
      : null;

  const finalOrder =
    updateOrder(
      order.orderNumber,
      {
        status: 'confirmed',

        stock: {
          status: 'reserved',
          reservations
        },

        payment: {
          ...order.payment,
          ...payment,
          reference: pixReference
        },

        logistics: {
          status: 'pending',
          method: order.shipping.method
        }
      }
    );

  recordEvent({
    type: 'ORDER_CONFIRMED',
    orderNumber: order.orderNumber,
    requestId,
    data: {
      total: finalOrder.totals.total
    }
  });

  return finalOrder;
}

function getCompleteOrder(orderNumber) {
  return getOrder(orderNumber);
}

module.exports = {
  createCompleteOrder,
  getCompleteOrder
};
