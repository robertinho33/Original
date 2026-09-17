'use strict';

const { AppError } = require('../../core/app-error');

function assertItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      'O pedido precisa conter pelo menos um item.',
      {
        code: 'ORDER_EMPTY',
        status: 400
      }
    );
  }
}

function normalizeItem(item) {
  const sku = String(item?.sku || '').trim();
  const quantity = Number(item?.quantity);
  const unitPrice = Number(item?.unitPrice);

  if (!sku) {
    throw new AppError(
      'SKU do produto não informado.',
      {
        code: 'INVALID_SKU',
        status: 400
      }
    );
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      'Quantidade do produto inválida.',
      {
        code: 'INVALID_QUANTITY',
        status: 400
      }
    );
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new AppError(
      `Preço inválido para o SKU ${sku}.`,
      {
        code: 'INVALID_PRICE',
        status: 400
      }
    );
  }

  return {
    sku,
    quantity,
    unitPrice
  };
}

function normalizeItems(items) {
  assertItems(items);
  return items.map(normalizeItem);
}

module.exports = {
  assertItems,
  normalizeItem,
  normalizeItems
};
