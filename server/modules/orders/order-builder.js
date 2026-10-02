'use strict';

const { AppError } = require('../../core/app-error');
const { calculateOrderTotal } = require('./order-service');
const { createOrderDraft } = require('./order-factory');

function normalizeAuthoritativeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      'O pedido precisa conter pelo menos um item.',
      {
        code: 'ORDER_EMPTY',
        status: 400
      }
    );
  }

  return items.map((item) => {
    const sku = String(
      item?.sku ?? ''
    ).trim();

    const quantity = Number(
      item?.quantity ?? 0
    );

    const unitPrice = Number(
      item?.unitPrice
    );

    if (!sku) {
      throw new AppError(
        'SKU do produto não informado.',
        {
          code: 'INVALID_SKU',
          status: 400
        }
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new AppError(
        'Quantidade do produto inválida.',
        {
          code: 'INVALID_QUANTITY',
          status: 400
        }
      );
    }

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      throw new AppError(
        `Preço inválido para o SKU ${sku}.`,
        {
          code: 'INVALID_PRICE',
          status: 400
        }
      );
    }

    return {
      ...item,
      sku,
      quantity,
      unitPrice
    };
  });
}

function buildOrder({
  items,
  shipping = 0,
  discount = 0,
  customer = {},
  paymentMethod = 'pix'
}) {
  const normalized =
    normalizeAuthoritativeItems(items);

  const subtotal =
    normalized.reduce((sum, item) => {
      return sum +
        item.quantity *
        item.unitPrice;
    }, 0);

  const total =
    calculateOrderTotal({
      items: normalized,
      shipping,
      discount
    });

  if (
    !Number.isFinite(total) ||
    total < 0
  ) {
    throw new AppError(
      'Total do pedido inválido.',
      {
        code: 'INVALID_ORDER_TOTAL',
        status: 400
      }
    );
  }

  return createOrderDraft({
    items: normalized,
    subtotal,
    shipping,
    discount,
    total,
    customer,
    paymentMethod
  });
}

module.exports = {
  buildOrder
};