'use strict';

const { AppError } = require('../../core/app-error');
const repository = require('./order-repository');
const { prepareOrder } = require('./order-authority');

function createOrder(payload) {
  const order = prepareOrder(payload);

  const existing = repository.findByOrderNumber(order.orderNumber);

  if (existing) {
    throw new AppError(
      'Conflito ao gerar pedido.',
      {
        code: 'ORDER_CONFLICT',
        status: 409
      }
    );
  }

  return repository.create(order);
}

function getOrder(orderNumber) {
  const order = repository.findByOrderNumber(orderNumber);

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

function listOrders(options) {
  return repository.findAll(options);
}

function updateOrder(orderNumber, changes) {
  const updated = repository.update(orderNumber, changes);

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
