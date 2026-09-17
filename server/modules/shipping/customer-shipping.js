'use strict';

const {
  createCustomerSnapshot
} = require('../customers/customer-service');

const {
  prepareShipping
} = require('../shipping/shipping-domain');

function prepareCustomerAndShipping({
  customer,
  address = null,
  deliveryMethod = 'delivery'
}) {
  const shipping =
    prepareShipping({
      method: deliveryMethod,
      address
    });

  const customerSnapshot =
    createCustomerSnapshot({
      customer,
      address: shipping.address
    });

  return {
    customer: customerSnapshot,
    shipping
  };
}

module.exports = {
  prepareCustomerAndShipping
};
