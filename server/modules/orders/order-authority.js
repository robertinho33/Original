'use strict';

const { resolveProduct } = require('../catalog/product-resolver');

async function prepareOrder({
  items,
  shipping = 0,
  discount = 0,
  customer = {},
  paymentMethod = 'pix',
  coupon = null
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Itens do pedido são obrigatórios.');
  }

  const requestedItems = items.map((item) => {
    const sku = String(
      item?.sku ??
      item?.SKU ??
      ''
    ).trim();

    const quantity = Number(
      item?.quantity ?? 0
    );

    if (!sku) {
      throw new Error(
        'SKU do produto é obrigatório.'
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Quantidade inválida para o SKU ${sku}.`
      );
    }

    return {
      sku,
      quantity
    };
  });

  const authoritativeItems =
    await Promise.all(
      requestedItems.map((item) => {
        return resolveProduct(
          item.sku,
          item.quantity
        );
      })
    );

  const {
    buildOrder
  } = require('./order-builder');

  return buildOrder({
    items: authoritativeItems,
    shipping,
    discount,
    customer,
    paymentMethod,
    coupon
  });
}

module.exports = {
  prepareOrder
};
