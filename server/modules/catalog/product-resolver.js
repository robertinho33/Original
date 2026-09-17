'use strict';

const { AppError } = require('../../core/app-error');

const {
  findProductBySku,
  getProductSku,
  getProductPrice,
  getProductStock
} = require('../catalog/catalog-service');

function normalizePrice(value) {
  if (typeof value === 'number') {
    return value;
  }

  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const price = Number(normalized);

  return Number.isFinite(price) ? price : NaN;
}

function normalizeStock(value) {
  const stock = Number(value);

  return Number.isInteger(stock) && stock >= 0
    ? stock
    : NaN;
}

function resolveProduct(sku, quantity) {
  const product = findProductBySku(sku);

  if (!product) {
    throw new AppError(
      `Produto ${sku} não encontrado.`,
      {
        code: 'PRODUCT_NOT_FOUND',
        status: 404
      }
    );
  }

  const unitPrice = normalizePrice(getProductPrice(product));
  const stock = normalizeStock(getProductStock(product));

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new AppError(
      `Preço inválido para ${sku}.`,
      {
        code: 'PRODUCT_PRICE_INVALID',
        status: 500
      }
    );
  }

  if (!Number.isInteger(stock)) {
    throw new AppError(
      `Estoque inválido para ${sku}.`,
      {
        code: 'PRODUCT_STOCK_INVALID',
        status: 500
      }
    );
  }

  if (quantity > stock) {
    throw new AppError(
      `Estoque insuficiente para ${sku}.`,
      {
        code: 'INSUFFICIENT_STOCK',
        status: 409,
        details: {
          sku,
          available: stock,
          requested: quantity
        }
      }
    );
  }

  return {
    sku: getProductSku(product),
    name: product.Produto ?? product.produto ?? product.name ?? '',
    quantity,
    unitPrice,
    stock
  };
}

module.exports = {
  resolveProduct,
  normalizePrice,
  normalizeStock
};
