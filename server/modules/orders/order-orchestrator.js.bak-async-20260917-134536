'use strict';

const { AppError } = require('../../core/app-error');

const {
  createOrder,
  getOrder,
  updateOrder
} = require('./order-persistence');

const {
  reserveProductStock
} = require('../inventory/inventory-domain');

const {
  findProductBySku
} = require('../catalog/catalog-service');

const {
  createPaymentIntent
} = require('../payments/payment-service');

const {
  createPixReference
} = require('../payments/pix-provider');

const {
  recordEvent
} = require('../../infrastructure/audit');

function reserveOrderStock(order) {
  const reservations = [];

  for (const item of order.items) {
    const product = findProductBySku(item.sku);

    if (!product) {
      throw new AppError(
        `Produto ${item.sku} não encontrado.`,
        {
          code: 'PRODUCT_NOT_FOUND',
          status: 404
        }
      );
    }

    const updated = reserveProductStock(
      {
        ...product,
        stock:
          product.Estoque ??
          product.estoque ??
          product.stock ??
          0
      },
      item.quantity
    );

    reservations.push({
      sku: item.sku,
      quantity: item.quantity,
      remainingStock: updated.stock
    });
  }

  return reservations;
}

function createOrderWithPayment(payload, requestId) {
  const order = createOrder(payload);

  recordEvent({
    type: 'ORDER_CREATED',
    orderNumber: order.orderNumber,
    requestId,
    data: {
      total: order.totals.total
    }
  });

  const reservations = reserveOrderStock(order);

  recordEvent({
    type: 'STOCK_RESERVED',
    orderNumber: order.orderNumber,
    requestId,
    data: {
      reservations
    }
  });

  const payment = createPaymentIntent({
    orderNumber: order.orderNumber,
    amount: order.totals.total,
    method: order.payment?.method || 'pix'
  });

  const paymentReference =
    payment.method === 'pix'
      ? createPixReference({
          orderNumber: order.orderNumber,
          amount: order.totals.total
        })
      : null;

  const updated = updateOrder(
    order.orderNumber,
    {
      status: 'confirmed',
      payment: {
        ...order.payment,
        ...payment,
        reference: paymentReference
      },
      stock: {
        status: 'reserved',
        reservations
      }
    }
  );

  recordEvent({
    type: 'PAYMENT_INTENT_CREATED',
    orderNumber: order.orderNumber,
    requestId,
    data: {
      method: payment.method,
      amount: payment.amount
    }
  });

  return updated;
}

function confirmPayment(orderNumber, requestId) {
  const order = getOrder(orderNumber);

  if (order.payment?.status === 'paid') {
    return order;
  }

  const updated = updateOrder(
    orderNumber,
    {
      status: 'processing',
      payment: {
        ...order.payment,
        status: 'paid',
        paidAt: new Date().toISOString()
      }
    }
  );

  recordEvent({
    type: 'PAYMENT_CONFIRMED',
    orderNumber,
    requestId
  });

  return updated;
}

module.exports = {
  createOrderWithPayment,
  confirmPayment,
  reserveOrderStock
};
