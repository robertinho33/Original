'use strict';

const { randomBytes } = require('node:crypto');

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
const { sendOrderWhatsApp } = require('../communication/whatsapp-order-service');

async function createCompleteOrder(payload, requestId) {
  const draft = await buildCompleteOrder(payload);

  const order = await createOrder({
    ...draft,
    status: 'pending',
    publicTrackingToken: randomBytes(32).toString('hex')
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
    await reserveOrderStock(order);

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
    await updateOrder(
      order.orderNumber,
      {
        status: 'pending',

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

  try {
    const whatsapp = await sendOrderWhatsApp(finalOrder);
    finalOrder.whatsappDelivery = whatsapp;
    if (!whatsapp.sent) {
      console.warn('[WHATSAPP] Confirmação do pedido não enviada:', finalOrder.orderNumber, whatsapp.reason);
    }
  } catch (error) {
    console.error('[WHATSAPP] Erro ao enviar confirmação:', finalOrder.orderNumber, error.message);
    finalOrder.whatsappDelivery = { sent: false, reason: 'provider_error' };
  }

  return finalOrder;
}

async function getCompleteOrder(orderNumber) {
  return getOrder(orderNumber);
}

module.exports = {
  createCompleteOrder,
  getCompleteOrder
};
