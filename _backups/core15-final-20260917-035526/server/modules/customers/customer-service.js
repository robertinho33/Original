'use strict';

const crypto = require('crypto');

const {
  normalizeCustomer
} = require('./customer-validator');

const {
  normalizeAddress
} = require('./address-validator');

function createCustomerSnapshot({
  customer,
  address = null
}) {
  const normalizedCustomer =
    normalizeCustomer(customer);

  return {
    id: `cus_${crypto.randomUUID()}`,
    ...normalizedCustomer,
    address: address
      ? normalizeAddress(address)
      : null
  };
}

module.exports = {
  createCustomerSnapshot
};
