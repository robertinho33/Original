'use strict';

const { AppError } = require('../../core/app-error');

const DELIVERY_COST = 19.90;

function calculateShipping({
  method,
  address = null
}) {
  if (method === 'pickup') {
    return {
      method: 'pickup',
      cost: 0,
      address: null
    };
  }

  if (method !== 'delivery') {
    throw new AppError(
      'Modalidade de entrega inválida.',
      {
        code: 'INVALID_DELIVERY_METHOD',
        status: 400
      }
    );
  }

  if (!address) {
    throw new AppError(
      'Endereço obrigatório para entrega.',
      {
        code: 'DELIVERY_ADDRESS_REQUIRED',
        status: 400
      }
    );
  }

  return {
    method: 'delivery',
    cost: Number(DELIVERY_COST.toFixed(2)),
    address
  };
}

module.exports = {
  DELIVERY_COST,
  calculateShipping
};
