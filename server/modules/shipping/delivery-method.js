'use strict';

const { AppError } = require('../../core/app-error');

const DELIVERY_METHODS = Object.freeze({
  DELIVERY: 'delivery',
  PICKUP: 'pickup'
});

function normalizeDeliveryMethod(value) {
  const method = String(value ?? 'delivery')
    .trim()
    .toLowerCase();

  if (
    method !== DELIVERY_METHODS.DELIVERY &&
    method !== DELIVERY_METHODS.PICKUP
  ) {
    throw new AppError(
      'Modalidade de entrega inválida.',
      {
        code: 'INVALID_DELIVERY_METHOD',
        status: 400
      }
    );
  }

  return method;
}

module.exports = {
  DELIVERY_METHODS,
  normalizeDeliveryMethod
};
