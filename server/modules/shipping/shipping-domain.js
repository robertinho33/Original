'use strict';

const {
  normalizeDeliveryMethod
} = require('./delivery-method');

const {
  calculateShipping
} = require('./shipping-service');

const {
  normalizeAddress
} = require('../customers/address-validator');

function prepareShipping({
  method = 'delivery',
  address = null
}) {
  const normalizedMethod =
    normalizeDeliveryMethod(method);

  const normalizedAddress =
    normalizedMethod === 'delivery'
      ? normalizeAddress(address)
      : null;

  return calculateShipping({
    method: normalizedMethod,
    address: normalizedAddress
  });
}

module.exports = {
  prepareShipping
};
