'use strict';

const { AppError } = require('./app-error');

function validateOrderPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new AppError(
      'Payload inválido.',
      {
        code: 'INVALID_PAYLOAD',
        status: 400
      }
    );
  }

  if (!Array.isArray(payload.items)) {
    throw new AppError(
      'Itens do pedido inválidos.',
      {
        code: 'INVALID_ITEMS',
        status: 400
      }
    );
  }

  if (payload.items.length > 100) {
    throw new AppError(
      'Quantidade excessiva de itens.',
      {
        code: 'TOO_MANY_ITEMS',
        status: 400
      }
    );
  }

  if (
    payload.customer !== undefined &&
    (
      typeof payload.customer !== 'object' ||
      Array.isArray(payload.customer)
    )
  ) {
    throw new AppError(
      'Cliente inválido.',
      {
        code: 'INVALID_CUSTOMER',
        status: 400
      }
    );
  }

  return payload;
}

module.exports = {
  validateOrderPayload
};
