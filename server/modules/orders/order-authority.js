'use strict';

const { normalizeItems } = require('./order-validator');
const { buildOrder } = require('./order-builder');
const { resolveProduct } = require('../catalog/product-resolver');

function prepareOrder({
  items,
  shipping = 0,
  discount = 0,
  customer = {},
  paymentMethod = 'pix'
}) {
  const requestedItems = normalizeItems(items);

  const authoritativeItems = requestedItems.map(item => {
    return resolveProduct(item.sku, item.quantity);
  });

  return buildOrder({
    items: authoritativeItems,
    shipping,
    discount,
    customer,
    paymentMethod
  });
}

module.exports = {
  prepareOrder
};
