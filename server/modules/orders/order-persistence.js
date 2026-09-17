'use strict';

const { AppError } = require('../../core/app-error');
const repository = require('./order-repository');
const { prepareOrder } = require('./order-authority');

async function createOrder(payload) {
  const order = prepareOrder(payload);

  const existing = await repository.findByOrderNumber(order.orderNumber);

  if (existing) {
    throw new AppError(
      'Conflito ao gerar pedido.',
      {
        code: 'ORDER_CONFLICT',
        status: 409
      }
    );
  }

  return await repository.create(order);
}

async function getOrder(orderNumber) {
  const order = await repository.findByOrderNumber(orderNumber);

  if (!order) {
    throw new AppError(
      'Pedido não encontrado.',
      {
        code: 'ORDER_NOT_FOUND',
        status: 404
      }
    );
  }

  return order;
}

async function listOrders(options) {
  return await repository.findAll(options);
}

async function updateOrder(orderNumber, changes) {
  const updated = await repository.update(orderNumber, changes);

  if (!updated) {
    throw new AppError(
      'Pedido não encontrado.',
      {
        code: 'ORDER_NOT_FOUND',
        status: 404
      }
    );
  }

  return updated;
}

module.exports = {
  createOrder,
  getOrder,
  listOrders,
  updateOrder
};

