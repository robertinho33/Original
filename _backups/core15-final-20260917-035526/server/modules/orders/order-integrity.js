'use strict';

const { AppError } = require('../../core/app-error');

function assertUniqueOrder(orderRepository, orderNumber) {
  const existing =
    orderRepository.findByOrderNumber(orderNumber);

  if (existing) {
    throw new AppError(
      'Pedido já registrado.',
      {
        code: 'ORDER_ALREADY_EXISTS',
        status: 409,
        details: {
          orderNumber
        }
      }
    );
  }
}

module.exports = {
  assertUniqueOrder
};
